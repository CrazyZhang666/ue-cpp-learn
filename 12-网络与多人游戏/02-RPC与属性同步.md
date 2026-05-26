# 12.2 RPC与属性同步

> **目标**：掌握RPC（远程过程调用）和属性复制的原理与实现，能够编写网络同步的游戏逻辑。

---

## 目录

1. [什么是RPC](#什么是rpc)
2. [Server RPC](#server-rpc)
3. [Client RPC](#client-rpc)
4. [NetMulticast RPC](#netmulticast-rpc)
5. [Reliable vs Unreliable](#reliable-vs-unreliable)
6. [属性同步（Replication）](#属性同步replication)
7. [DOREPLIFETIME 宏](#doreplifetime-宏)
8. [复制条件](#复制条件)
9. [OnRep 回调函数](#onrep-回调函数)
10. [RPC 与属性同步的对比总结](#rpc-与属性同步的对比总结)
11. [小结与检查清单](#小结与检查清单)

---

## 什么是RPC

### 基本概念

**RPC（Remote Procedure Call，远程过程调用）** 是一种让一台机器调用另一台机器上的函数的机制。在 UE5 中，RPC 是客户端和服务器之间通信的基本方式。

打个比方：

- **普通函数调用**：你喊自己房间里的朋友帮忙拿水（同一台机器上）。
- **RPC**：你打电话给隔壁房间的朋友，请他帮忙拿水（不同的机器）。

### UE5 中的三种 RPC 类型

| RPC 类型             | 谁可以调用 | 在哪里执行   | 典型用途                   |
| -------------------- | ---------- | ------------ | -------------------------- |
| **Server RPC**       | 客户端     | 服务器       | 客户端请求开火、拾取物品   |
| **Client RPC**       | 服务器     | 拥有者客户端 | 显示伤害数字、播放特定声音 |
| **NetMulticast RPC** | 服务器     | 服务器和相关客户端 | 播放枪口火焰、爆炸特效     |

> **注意**：NetMulticast 只有在服务器对一个会复制的Actor调用时，才会发送到相关客户端。客户端自己调用Multicast函数时，不会自动广播给其他机器。

### RPC 的声明语法

```cpp
// Server RPC — 客户端调用，服务器执行
UFUNCTION(Server, Reliable)
void ServerDoSomething();

// Client RPC — 服务器调用，拥有者客户端执行
UFUNCTION(Client, Reliable)
void ClientShowMessage(const FString& Message);

// NetMulticast RPC — 服务器调用，服务器和相关客户端执行
UFUNCTION(NetMulticast, Reliable)
void MulticastPlayEffect(FVector Location);
```

---

## Server RPC

### 核心理解

Server RPC 是**最常用**的 RPC 类型。它的工作流程是：

1. **客户端**调用 `ServerDoSomething()`。
2. 这个调用**不会在客户端执行**，而是通过网络发送到服务器。
3. **服务器**收到后，执行实际的逻辑。
4. 如果需要，服务器再把结果同步回所有客户端。

### 完整代码示例：客户端请求开火

```cpp
// ===== 头文件：MyCharacter.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ============================================
    // Server RPC — 客户端调用，服务器执行
    // ============================================

    // 声明一个 Server RPC 函数
    // 客户端调用此函数请求开火
    // 服务器验证后执行真正的开火逻辑
    UFUNCTION(Server, Reliable, WithValidation)  // ← Server：客户端请求服务器执行；WithValidation：生成验证入口
    void ServerFireWeapon();         //   Reliable：连接正常时会重传直到确认，别用于高频事件

    // ☆ 重要：带 WithValidation 的 Server RPC 必须在 .cpp 中实现以下两个函数：
    //   1. ServerFireWeapon_Implementation() — 服务器端的实际执行逻辑
    //   2. ServerFireWeapon_Validate()      — 服务器端的参数验证

    // ============================================
    // 带参数的 Server RPC
    // ============================================

    // 客户端请求在指定位置使用指定类型的武器开火
    UFUNCTION(Server, Reliable, WithValidation)
    void ServerFireAtTarget(FVector TargetLocation, int32 WeaponType);

    // ============================================
    // Unreliable 版本的 Server RPC（用于高频操作）
    // ============================================

    // 客户端请求移动/旋转（高频，允许丢包）
    UFUNCTION(Server, Unreliable)
    void ServerMoveToLocation(FVector NewLocation, FRotator NewRotation);

private:
    // 弹药计数
    int32 CurrentAmmo = 30;

    // 服务器端的实际开火逻辑（不是 RPC，只是被 Server RPC 调用）
    void PerformFireOnServer();
};
```

```cpp
// ===== 实现文件：MyCharacter.cpp =====
#include "MyCharacter.h"
#include "Net/UnrealNetwork.h"
#include "Engine/Engine.h"

/// ============================================
// Server RPC 的实现
/// ============================================

// 服务器端执行的实际函数
// 命名规则：函数名 + _Implementation
void AMyCharacter::ServerFireWeapon_Implementation()
{
    // 💡 这个函数只在服务器上运行！
    // 客户端调用 ServerFireWeapon() 后，UE 引擎自动把调用发送到服务器，
    // 然后服务器执行这个 _Implementation 函数。

    // ===== 步骤1：验证请求是否合法 =====
    // 永远不要信任客户端的数据！验证一切！
    if (CurrentAmmo <= 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("开火失败：没有弹药了！"));
        return;  // 拒绝！客户端无法作弊
    }

    // ===== 步骤2：执行真正的逻辑 =====
    // 因为我们在服务器上（HasAuthority() 为 true），所以可以安全地修改状态
    CurrentAmmo--;          // 消耗一发弹药
    PerformFireOnServer();  // 服务器端执行真正的射击逻辑

    // ===== 步骤3：记录日志 =====
    UE_LOG(LogTemp, Log, TEXT("服务器：玩家开火！剩余弹药：%d"), CurrentAmmo);

    // 注意：CurrentAmmo 如果是 Replicated 属性，服务器修改后会在后续复制更新中同步到客户端
}

// 验证函数 — 服务器在执行 _Implementation 之前调用
// 命名规则：函数名 + _Validate
// ★ 返回值 true = 验证通过，继续执行 _Implementation
// ★ 返回值 false = 验证失败，拒绝这个 RPC 调用，客户端可能被踢出
bool AMyCharacter::ServerFireWeapon_Validate()
{
    // ===== 基础验证 =====
    // 验证弹药数量合法性（防止客户端发送负数弹药）
    if (CurrentAmmo < 0)
    {
        // 弹药数量异常！可能是作弊者
        UE_LOG(LogTemp, Error, TEXT("SUSPICIOUS：客户端报告的弹药数异常！"));
        return false;  // 拒绝！不执行 _Implementation
    }

    // ===== 可以添加更多验证 =====
    // 例如：检查射击间隔是否合法（防止射速外挂）
    // 例如：检查武器类型是否合法

    return true;  // 验证通过
}

/// ============================================
// 带参数的 Server RPC 实现
/// ============================================

void AMyCharacter::ServerFireAtTarget_Implementation(
    FVector TargetLocation,      // 客户端声称的目标位置
    int32 WeaponType             // 客户端选择的武器类型
)
{
    // ===== 验证客户端提交的数据 =====

    // 验证1：目标位置是否在合理范围内？
    if (TargetLocation.Size() > 100000.0f)  // 10万单位，大约1公里
    {
        UE_LOG(LogTemp, Warning, TEXT("目标位置太远了！可能是作弊"));
        return;
    }

    // 验证2：武器类型是否合法？
    if (WeaponType < 0 || WeaponType > 5)  // 假设只有0-5共6种武器
    {
        UE_LOG(LogTemp, Warning, TEXT("不存在的武器类型！可能是作弊"));
        return;
    }

    // ===== 验证通过，执行逻辑 =====
    // 执行精确的服务器端命中判定（Line Trace等）
    UE_LOG(LogTemp, Log, TEXT("服务器：使用武器%d向(%f,%f,%f)开火"),
        WeaponType,
        TargetLocation.X, TargetLocation.Y, TargetLocation.Z
    );
}

bool AMyCharacter::ServerFireAtTarget_Validate(
    FVector TargetLocation,
    int32 WeaponType
)
{
    // 带参数的 Validate 也要验证参数
    if (WeaponType < 0 || WeaponType > 5)
    {
        return false;
    }
    // 验证位置是否有 NaN（非数字）值（恶意客户端可能发送损坏的数据）
    if (TargetLocation.ContainsNaN())
    {
        return false;
    }
    return true;
}

/// ============================================
// Unreliable Server RPC 实现
/// ============================================

void AMyCharacter::ServerMoveToLocation_Implementation(
    FVector NewLocation,
    FRotator NewRotation
)
{
    // 服务器接收到客户端发来的移动请求
    // 因为是 Unreliable，可能丢包，但移动是高频操作，丢几帧问题不大

    // 简单的反作弊：检查移动距离
    FVector CurrentLocation = GetActorLocation();
    float Distance = FVector::Dist(CurrentLocation, NewLocation);

    // 如果一帧内移动了超过500单位（约5米），很可疑！
    // （正常跑步一帧最多移动几十单位）
    if (Distance > 500.0f)
    {
        // 可能是加速外挂或瞬移
        UE_LOG(LogTemp, Warning, TEXT("SUSPICIOUS：一帧移动了%f单位！"), Distance);
        // 可以拒绝这次移动，或回弹到上一个合法位置
        return;
    }

    // 验证通过，更新服务器上的位置
    SetActorLocation(NewLocation);
    SetActorRotation(NewRotation);
    // 注意：位置变化通过属性同步自动通知其他客户端
}

// 这个Unreliable RPC没有写WithValidation，所以只需要_Implementation
// 仍然要在_Implementation内部做必要校验，尤其是客户端传来的位置/角度数据

/// ============================================
// 辅助函数：服务器端实际开火
/// ============================================

void AMyCharacter::PerformFireOnServer()
{
    // 这里执行服务器端的射线检测、伤害计算等
    // 因为只有服务器执行，所以结果天然是权威的

    // 伪代码示意：
    // FHitResult Hit;
    // GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility);
    // if (Hit.bBlockingHit)
    // {
    //     对 Hit.GetActor() 造成伤害
    // }
}
```

### Server RPC 的调用方式

```cpp
// ===== 在客户端代码中调用 =====

// ✅ 正确：客户端调用 Server RPC，由服务器执行
void AMyCharacter::OnFireButtonPressed()
{
    // 这个方法在客户端上被调用（玩家按下了开火键）

    if (IsLocallyControlled())        // 这是我自己的角色
    {
        ServerFireWeapon();           // 发送 RPC 到服务器
        // ⚠️ 注意：ServerFireWeapon() 在客户端上什么都不执行！
        // 客户端只是发送了一个网络请求

        // 但是，你可以同时播放一些本地效果：
        PlayLocalMuzzleFlash();       // 本地（预测性）枪口火焰
        PlayLocalFireSound();         // 本地开火音效
    }
}

// ❌ 错误：在服务器上调用 Server RPC（虽然能编译但没必要）
void AMyCharacter::SomeServerFunction()
{
    if (HasAuthority())
    {
        // 已经在服务器上了，直接调用逻辑即可，不要绕一圈
        ServerFireWeapon();  // 能工作但多余，直接调用 PerformFireOnServer() 更好
    }
}
```

### Server RPC 关键要点总结

```cpp
// 声明：
UFUNCTION(Server, Reliable, WithValidation)    // 需要_Validate时才加WithValidation
void ServerXxx();

// 必须实现的函数：
void ServerXxx_Implementation();  // 服务器执行的实际逻辑
bool ServerXxx_Validate();        // 只有声明里写了WithValidation时才需要

// 调用者：客户端（AutonomousProxy）
// 执行者：服务器
// 命名约定：以 "Server" 开头（如 ServerFire, ServerPickupItem）
```

---

## Client RPC

### 核心理解

Client RPC 是 Server RPC 的反向操作：

1. **服务器**调用 `ClientShowMessage()`。
2. 调用通过网络发送到**特定的客户端**（拥有者客户端）。
3. **只有那个客户端**执行这个函数。
4. 其他客户端**不会**执行。

> **什么是"拥有者客户端"？** 就是控制这个 Actor 的客户端。比如你操控的角色，你就是这个 Actor 的拥有者客户端。

### 完整代码示例

```cpp
// ===== 头文件：MyCharacter.h =====
UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    /// ============================================
    // Client RPC — 服务器调用，拥有者客户端执行
    /// ============================================

    // 给被击中的玩家显示伤害数字
    // 服务器调用此函数，只有被击中的那个客户端会看到伤害数字
    UFUNCTION(Client, Reliable)
    void ClientShowDamageNumber(float DamageAmount, bool bIsCritical);

    // 给被击中的玩家显示屏幕变红效果
    UFUNCTION(Client, Reliable)
    void ClientShowHitEffect(float DamagePercent);

    // 发给特定玩家的消息（比如"你被踢出了游戏"）
    UFUNCTION(Client, Reliable)
    void ClientReceiveKickMessage(const FString& Reason);

    // 高频更新（Unreliable 版本）
    UFUNCTION(Client, Unreliable)
    void ClientUpdateAmmoUI(int32 CurrentAmmo, int32 MaxAmmo);

private:
    // 血量（这将是一个 Replicated 属性，我们稍后讲到）
    UPROPERTY(Replicated)
    float Health = 100.0f;
};
```

```cpp
// ===== 实现文件：MyCharacter.cpp =====

/// ============================================
// Client RPC 的实现
/// ============================================

void AMyCharacter::ClientShowDamageNumber_Implementation(
    float DamageAmount,
    bool bIsCritical
)
{
    // 💡 这个函数只在"拥有者客户端"上执行！
    // 也就是说，只有被击中的玩家自己的屏幕上会显示这个伤害数字

    // ===== 在这里更新本地UI =====
    // 注意：UI操作不需要服务器权威，所以在客户端直接做就行

    if (bIsCritical)
    {
        // 暴击伤害显示为金色大字
        // 伪代码：HUD->ShowDamageNumber(DamageAmount, FColor::Gold, 2.0f);
        UE_LOG(LogTemp, Log, TEXT("暴击！受到 %f 点伤害"), DamageAmount);
    }
    else
    {
        // 普通伤害显示为白色
        // 伪代码：HUD->ShowDamageNumber(DamageAmount, FColor::White, 1.0f);
        UE_LOG(LogTemp, Log, TEXT("受到 %f 点伤害"), DamageAmount);
    }
}

void AMyCharacter::ClientShowHitEffect_Implementation(float DamagePercent)
{
    // 屏幕边缘变红，血量越低越红
    // 伪代码：HUD->SetDamageVignette(DamagePercent);
    // 播放受击音效
    // 伪代码：UGameplayStatics::PlaySound2D(this, HitSound);

    UE_LOG(LogTemp, Log, TEXT("客户端：受击效果，血量百分比 %f"), DamagePercent);
}

void AMyCharacter::ClientReceiveKickMessage_Implementation(const FString& Reason)
{
    // 显示"你被踢出服务器"的UI
    // 注意：这是 UI 层面的操作，在客户端执行很合适
    UE_LOG(LogTemp, Warning, TEXT("你被踢出了游戏，原因：%s"), *Reason);
}

void AMyCharacter::ClientUpdateAmmoUI_Implementation(int32 CurrentAmmo, int32 MaxAmmo)
{
    // 更新弹药UI
    // 因为是 Unreliable，可能丢包，但弹药UI每帧都更新，丢几帧没关系
    // 伪代码：HUD->SetAmmo(CurrentAmmo, MaxAmmo);
}
```

### Client RPC 的调用方式

```cpp
// ===== 在服务器代码中调用 Client RPC =====

void AMyCharacter::ApplyDamageOnServer(float Damage)
{
    // ✅ 这段代码在服务器上执行
    if (!HasAuthority())
    {
        return;  // 确保只在服务器执行
    }

    // 1. 先修改权威状态
    Health -= Damage;

    // 2. 如果血量降到0，角色死亡
    if (Health <= 0)
    {
        Health = 0;
        // ... 处理死亡逻辑
    }

    // 3. 如果角色还活着，通过 Client RPC 通知客户端的玩家
    //    Client RPC 只发给"拥有者客户端"
    bool bIsCritical = (Damage >= 50.0f);   // 假设50以上是暴击
    ClientShowDamageNumber(Damage, bIsCritical);

    // 4. 通知所有客户端播放受击特效（用多播RPC）
    float DamagePercent = Health / 100.0f;
    MulticastPlayHitEffect();  // 所有客户端都看到火花特效
}

// ❌ 错误：在客户端调用 Client RPC（无法工作）
void AMyCharacter::SomeClientFunction()
{
    if (!HasAuthority())
    {
        // Client RPC 只能从服务器调用！客户端调用不会产生任何效果
        ClientShowDamageNumber(10.0f, false); // ← 这行代码什么也不会发生！
    }
}
```

### Client RPC 与 Server RPC 的对比

```cpp
// ===== 对比：什么时候用 Server RPC，什么时候用 Client RPC =====

// 场景：玩家按下开火键 →
//   1. 客户端调用 Server RPC（ServerFireWeapon）发送给服务器
//   2. 服务器验证弹药、执行射线检测、计算伤害
//   3. 服务器对A造成伤害 → 对A调用 Client RPC（ClientShowDamageNumber）
//   4. 服务器对B造成伤害 → 对B调用 Client RPC（ClientShowDamageNumber）
//   5. 服务器调用 NetMulticast RPC（MulticastPlayMuzzleFlash）
//      相关客户端都看到枪口火焰

// Server RPC：客户端→服务器（"请求"）
// Client RPC：服务器→特定客户端（"通知"）
// NetMulticast RPC：服务器→服务器和相关客户端（"广播"）
```

---

## NetMulticast RPC

### 核心理解

NetMulticast RPC 用于从服务器向相关客户端"广播"一次性事件：

1. **服务器**调用 `MulticastPlayEffect()`。
2. 调用通过网络发送到这个复制Actor的**相关客户端**（Listen Server本地也会执行）。
3. 服务器和收到该Actor复制的客户端都会执行这个函数。
4. 客户端调用 NetMulticast RPC 只会在本地执行，不会广播给服务器或其他客户端。

### 完整代码示例

```cpp
// ===== 头文件：MyCharacter.h =====
UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    /// ============================================
    // NetMulticast RPC — 服务器调用，服务器和相关客户端执行
    /// ============================================

    // 相关客户端都播放枪口火焰特效
    UFUNCTION(NetMulticast, Reliable)
    void MulticastPlayMuzzleFlash();

    // 相关客户端都播放爆炸特效（带位置参数）
    UFUNCTION(NetMulticast, Reliable)
    void MulticastPlayExplosion(FVector ExplosionLocation, float ExplosionRadius);

    // Unreliable 版本（用于高频特效）
    UFUNCTION(NetMulticast, Unreliable)
    void MulticastPlayTrailEffect(FVector StartLocation, FVector EndLocation);

    // 所有客户端播放死亡动画
    UFUNCTION(NetMulticast, Reliable)
    void MulticastPlayDeathAnimation();

    // 所有客户端显示击杀提示
    UFUNCTION(NetMulticast, Reliable)
    void MulticastShowKillFeed(const FString& KillerName, const FString& VictimName);
};
```

```cpp
// ===== 实现文件：MyCharacter.cpp =====

void AMyCharacter::MulticastPlayMuzzleFlash_Implementation()
{
    // 💡 这个函数在"所有客户端"上执行（包括服务器如果是 Listen Server）
    // 适合播放视觉效果，因为视觉效果不需要服务器权威

    // 在枪口位置生成枪口火焰粒子特效
    // 伪代码：
    // UGameplayStatics::SpawnEmitterAttached(
    //     MuzzleFlashParticle,       // 特效资产
    //     WeaponMesh,                // 附着到武器模型
    //     TEXT("MuzzleSocket"),      // 枪口插槽
    //     FVector::ZeroVector,       // 相对位置（零点=就在插槽位置）
    //     FRotator::ZeroRotator,     // 相对旋转
    //     FVector(1.0f),             // 缩放
    //     EAttachLocation::SnapToTarget  // 对齐模式
    // );

    UE_LOG(LogTemp, Log, TEXT("客户端：播放枪口火焰！"));
}

void AMyCharacter::MulticastPlayExplosion_Implementation(
    FVector ExplosionLocation,
    float ExplosionRadius
)
{
    // 所有客户端都在指定位置播放爆炸特效
    // 注意：因为所有客户端使用相同的位置参数，所以爆炸看起来在同一个地方

    // 伪代码：
    // UGameplayStatics::SpawnEmitterAtLocation(
    //     GetWorld(),
    //     ExplosionParticle,       // 爆炸粒子
    //     ExplosionLocation,       // 爆炸位置（服务器发来的）
    //     FRotator::ZeroRotator,
    //     FVector(ExplosionRadius / 100.0f)  // 根据半径调整大小
    // );

    UE_LOG(LogTemp, Log, TEXT("客户端：播放爆炸特效于(%f,%f,%f)，半径%f"),
        ExplosionLocation.X, ExplosionLocation.Y, ExplosionLocation.Z,
        ExplosionRadius
    );
}

void AMyCharacter::MulticastPlayTrailEffect_Implementation(
    FVector StartLocation,
    FVector EndLocation
)
{
    // Unreliable 多播：用于高频更新的拖尾特效
    // 可能丢包，但特效丢了也无所谓

    // 伪代码：生成子弹拖尾特效
    UE_LOG(LogTemp, Verbose, TEXT("客户端：播放子弹拖尾"));
}

void AMyCharacter::MulticastPlayDeathAnimation_Implementation()
{
    // 所有客户端看到这个角色播放死亡动画
    // 假设 DeathMontage 是一个 UAnimMontage
    // PlayAnimMontage(DeathMontage);

    UE_LOG(LogTemp, Log, TEXT("客户端：播放死亡动画"));
}

void AMyCharacter::MulticastShowKillFeed_Implementation(
    const FString& KillerName,
    const FString& VictimName
)
{
    // 所有客户端显示击杀信息
    // 伪代码：HUD->AddKillFeedEntry(KillerName, VictimName);
    UE_LOG(LogTemp, Log, TEXT("击杀提示：%s 击杀了 %s"), *KillerName, *VictimName);
}
```

### NetMulticast RPC 的调用方式

```cpp
// ===== 在服务器代码中调用多播 RPC =====

void AMyCharacter::FireWeaponOnServer()
{
    if (!HasAuthority()) return;  // 只在服务器执行

    // 执行射线检测...

    // 1. 播放枪口火焰 — 所有客户端都要看到
    MulticastPlayMuzzleFlash();

    // 2. 如果命中了爆炸桶，播放爆炸 — 所有客户端都要看到
    if (bHitExplosiveBarrel)
    {
        MulticastPlayExplosion(HitLocation, 300.0f);
    }

    // 3. 如果击杀了一个玩家
    if (bKilledPlayer)
    {
        // 显示击杀提示 — 所有客户端看到
        MulticastShowKillFeed(GetName(), VictimPlayer->GetName());

        // 播放死亡动画 — 所有客户端看到
        VictimPlayer->MulticastPlayDeathAnimation();

        // 给被击杀的玩家显示特定的 UI（用 Client RPC）
        VictimPlayer->ClientShowDeathScreen();  // 只有死者看到
    }
}

// ❌ 错误：客户端调用 NetMulticast RPC
void AMyCharacter::OnClientTriesToBroadcast()
{
    if (!HasAuthority())
    {
        // 客户端调用多播 RPC 只会在本地执行，不会广播给服务器或其他客户端
        // 真正的多播必须由服务器在可复制Actor上发起
        MulticastPlayMuzzleFlash();  // ← 只影响本机，不是网络广播
    }
}
```

---

## Reliable vs Unreliable

### 核心对比

```cpp
// Reliable（可靠）：连接正常时重传直到确认，并保持顺序
UFUNCTION(Server, Reliable)
void ServerImportantAction();

// Unreliable（不可靠）：不保证送达，可能丢包
UFUNCTION(Server, Unreliable)
void ServerFrequentUpdate();
```

### 详细对比表

| 特性     | Reliable                | Unreliable           |
| -------- | ----------------------- | -------------------- |
| 送达保证 | ✅ 保证送达，丢包会重发 | ❌ 不保证送达        |
| 顺序保证 | ✅ 保证按发送顺序到达   | ❌ 可能乱序          |
| 延迟     | 可能较高（需要重传）    | 较低（不重传）       |
| 带宽占用 | 较高（有确认包）        | 较低                 |
| 适用场景 | 重要的一次性事件        | 高频的、可丢失的更新 |

### 使用场景指南

```cpp
// ===== ✅ 应该使用 Reliable 的场景 =====

// 原因：这些事件"必须"到达，一次都不能丢
UFUNCTION(Server, Reliable)
void ServerFireWeapon();           // 开火请求（丢了=玩家白按了）

UFUNCTION(Server, Reliable)
void ServerPickupItem(AActor* Item); // 拾取物品（丢了=物品还在）

UFUNCTION(Server, Reliable)
void ServerRespawnCharacter();     // 重生请求

UFUNCTION(Client, Reliable)
void ClientShowKillMessage();      // 击杀提示（必须显示）

UFUNCTION(NetMulticast, Reliable)
void MulticastEndGame(int32 WinningTeam); // 游戏结束消息（超级重要！）

// ===== ✅ 应该使用 Unreliable 的场景 =====

// 原因：这些事件高频发生，丢几个不影响体验
UFUNCTION(Server, Unreliable)
void ServerUpdateAimPitch(float Pitch); // 每帧更新瞄准角度

UFUNCTION(Server, Unreliable)
void ServerUpdateMovement(FVector Location); // 每帧更新位置

UFUNCTION(NetMulticast, Unreliable)
void MulticastUpdateFootstepSound(); // 脚步声（偶尔丢一个无所谓）

UFUNCTION(NetMulticast, Unreliable)
void MulticastPlayContinuousTrail(); // 持续拖尾特效

// ===== ❌ 错误做法 =====

// 错误1：把重要事件标记为 Unreliable
UFUNCTION(Server, Unreliable)
void ServerPurchaseItem();  // ❌ 购买道具不能丢！应该用 Reliable

// 错误2：把高频更新标记为 Reliable
UFUNCTION(Server, Reliable)
void ServerUpdateCameraRotation(FRotator Rot); // ❌ 每帧调用会塞爆网络带宽
```

---

## 属性同步（Replication）

### 核心概念

属性同步（Replication）是 UE5 中另一种同步数据的方式。与 RPC 不同：

- **RPC**：一次性事件（"开火!"、"爆炸!"）
- **属性同步**：持续存在的状态（血量、分数、位置）

当服务器上的一个被标记为 `Replicated` 的属性发生变化时，UE 引擎会自动将新值发送给所有相关客户端。

### 声明同步属性

```cpp
// ===== 头文件：MyCharacter.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ============================================
    // 属性同步的三种声明方式
    // ============================================

    // 方式1：简单同步（只同步值，客户端收到后不做额外处理）
    // 引擎自动同步，客户端直接使用新值
    UPROPERTY(Replicated)
    float Health;               // 服务器修改后，自动同步到客户端

    UPROPERTY(Replicated)
    int32 Score;                // 分数

    UPROPERTY(Replicated)
    bool bIsAlive;              // 是否存活

    // 方式2：带回调的同步（同步 + 客户端收到后触发回调函数）
    // 当值在客户端上更新时，自动调用指定的回调函数
    UPROPERTY(ReplicatedUsing = OnRep_Armor)  // ← 变化时调用 OnRep_Armor()
    float Armor;

    UPROPERTY(ReplicatedUsing = OnRep_Ammo)
    int32 Ammo;

    UPROPERTY(ReplicatedUsing = OnRep_WeaponType)
    int32 CurrentWeaponType;

    // 方式3：条件同步（只在特定条件下同步）
    UPROPERTY(Replicated)
    FString PlayerName;  // 玩家名字 — 同步给所有人

    // ============================================
    // OnRep 回调函数声明
    // ============================================

    UFUNCTION()
    void OnRep_Armor();          // 当 Armor 在客户端上更新时调用

    UFUNCTION()
    void OnRep_Ammo();           // 当 Ammo 在客户端上更新时调用

    UFUNCTION()
    void OnRep_WeaponType();     // 当 CurrentWeaponType 在客户端上更新时调用

    // ============================================
    // 必须覆写的复制生命周期函数
    // ============================================

    virtual void GetLifetimeReplicatedProps(
        TArray<FLifetimeProperty>& OutLifetimeProps
    ) const override;

private:
    float MaxHealth = 100.0f;
    float MaxArmor = 50.0f;
    int32 MaxAmmo = 300;
};
```

### GetLifetimeReplicatedProps — 注册需要同步的属性

```cpp
// ===== 实现文件：MyCharacter.cpp =====
#include "MyCharacter.h"
#include "Net/UnrealNetwork.h"       // ← 必须包含这个头文件！否则 DOREPLIFETIME 宏无法使用

// ============================================
// GetLifetimeReplicatedProps
// 这个函数告诉 UE 引擎："这些属性需要通过网络同步"
// UE 引擎在 Actor 第一次被复制时调用一次
// ============================================
void AMyCharacter::GetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps   // 输出的属性数组
) const
{
    // ★ 必须调用 Super，确保父类的同步属性也注册了
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    // ============================================
    // DOREPLIFETIME — 无条件同步给所有相关客户端
    // ============================================
    // 参数1：类名
    // 参数2：属性名
    // 效果：只要服务器上的值改变，就会同步给所有需要知道这个值的客户端

    DOREPLIFETIME(AMyCharacter, Health);     // 血量 — 所有人需要看到（血条）
    DOREPLIFETIME(AMyCharacter, Score);      // 分数 — 所有人需要看到（计分板）
    DOREPLIFETIME(AMyCharacter, bIsAlive);   // 存活状态
    DOREPLIFETIME(AMyCharacter, PlayerName); // 玩家名字 — 显示在头顶

    // 带 ReplicatedUsing 的属性也是用 DOREPLIFETIME 注册
    // 引擎会自动检测 UPROPERTY 中的 ReplicatedUsing 并调用回调
    DOREPLIFETIME(AMyCharacter, Armor);
    DOREPLIFETIME(AMyCharacter, Ammo);
    DOREPLIFETIME(AMyCharacter, CurrentWeaponType);

    // ============================================
    // DOREPLIFETIME_CONDITION — 有条件地同步
    // ============================================
    // 使用情况：某个属性不需要同步给所有客户端

    // 示例：如果有一个"任务进度"属性，只对拥有者可见
    // DOREPLIFETIME_CONDITION(AMyCharacter, QuestProgress, COND_OwnerOnly);
}
```

---

## 复制条件

### 所有可用的复制条件

```cpp
// 引擎定义的复制条件枚举
enum ELifetimeCondition
{
    // ============================================
    // 无条件复制（默认）
    // ============================================
    COND_None,              // 无条件复制给所有相关客户端（DOREPLIFETIME 的默认行为）

    // ============================================
    // 初始阶段条件
    // ============================================
    COND_InitialOnly,       // 只在 Actor 第一次出现时复制一次
                            // 之后的值变化不复制
                            // 用途：初始装备、出生点位置

    // ============================================
    // 拥有者相关条件
    // ============================================
    COND_OwnerOnly,         // 只同步给"拥有者客户端"
                            // 用途：任务进度、背包内容、弹药（自己知道就行）

    COND_SkipOwner,         // 同步给"除了拥有者之外的所有客户端"
                            // 用途：在某些情况下减少带宽（拥有者可能通过其他方式知道）

    // ============================================
    // 模拟代理条件
    // ============================================
    COND_SimulatedOnly,     // 只同步给 SimulatedProxy（别人的Pawn）
                            // 用途：外观相关（自己不需要通过复制来知道自己长什么样）

    COND_AutonomousOnly,    // 只同步给 AutonomousProxy（拥有者的Pawn）
                            // 用途：UI 数据（比如弹药数，别人不需要知道你的弹药）

    // ============================================
    // 自定义条件
    // ============================================
    COND_Custom,            // 通过自定义函数决定是否复制
                            // 需要覆写 IsNetRelevantFor() 或使用自定义条件
};
```

### 复制条件的实际用法

```cpp
void AMyCharacter::GetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps
) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    // 示例1：血量 — 所有人都需要看到（血条、击杀判定）
    DOREPLIFETIME(AMyCharacter, Health);  // 等同于 COND_None

    // 示例2：弹药 — 只有自己需要知道（别人不需要看到你的子弹数量）
    DOREPLIFETIME_CONDITION(AMyCharacter, Ammo, COND_OwnerOnly);

    // 示例3：皮肤/外观 — 自己不需要（知道自己长什么样），但别人需要看到
    // （实际上外观通常用 COND_SimulatedOnly 或 COND_SkipOwner）
    DOREPLIFETIME_CONDITION(AMyCharacter, CharacterSkinID, COND_SkipOwner);

    // 示例4：只在初始时复制一次 — 玩家名字创建后不会改变
    DOREPLIFETIME_CONDITION(AMyCharacter, PlayerName, COND_InitialOnly);

    // 示例5：背包物品 — 只有拥有者需要知道
    // DOREPLIFETIME_CONDITION(AMyCharacter, InventoryItems, COND_OwnerOnly);
}

// ❌ 错误：把不需要同步的属性也注册
void AMyCharacter::BadGetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps
) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    // ❌ 错误：UI 组件指针不需要同步（UI 只存在于本地）
    // DOREPLIFETIME(AMyCharacter, HealthBarWidget);  // 错！指针不能这样同步

    // ❌ 错误：纯本地的缓存变量不需要同步
    // DOREPLIFETIME(AMyCharacter, CachedInputVector);  // 错！这是本地输入
}
```

---

## OnRep 回调函数

### 核心概念

`OnRep` 回调是当**客户端**收到服务器同步过来的新值时自动调用的函数。它让你在属性更新时执行额外的逻辑。

```
服务器修改Health → 引擎检测到变化 → 发送新值到客户端
                                       ↓
                                   客户端收到新值
                                       ↓
                                   自动调用 OnRep_Health()
                                       ↓
                        在 OnRep_Health() 中更新血条UI、播放受击动画
```

### 完整代码示例

```cpp
// ===== 头文件：MyCharacter.h =====
UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // 带 OnRep 的同步属性
    UPROPERTY(ReplicatedUsing = OnRep_Health)
    float Health;

    UPROPERTY(ReplicatedUsing = OnRep_Armor)
    float Armor;

    UPROPERTY(ReplicatedUsing = OnRep_Ammo)
    int32 Ammo;

    UPROPERTY(ReplicatedUsing = OnRep_WeaponType)
    int32 CurrentWeaponType;

    // OnRep 回调函数
    UFUNCTION()
    void OnRep_Health();

    UFUNCTION()
    void OnRep_Armor();

    UFUNCTION()
    void OnRep_Ammo();

    UFUNCTION()
    void OnRep_WeaponType();

    virtual void GetLifetimeReplicatedProps(
        TArray<FLifetimeProperty>& OutLifetimeProps
    ) const override;

private:
    // 客户端本地的 UI 更新函数
    void UpdateHealthUI();
    void UpdateArmorUI();
    void UpdateAmmoUI();
    void PlayHitReactionAnimation();
};
```

```cpp
// ===== 实现文件：MyCharacter.cpp =====

// 修改血量（只在服务器上调用）
void AMyCharacter::ServerModifyHealth(float Delta)
{
    if (!HasAuthority()) return;  // 双重保险：确保在服务器

    Health = FMath::Clamp(Health + Delta, 0.0f, MaxHealth);
    // ↑ 修改 Health 后，引擎自动检测到变化
    // 然后自动把新值同步给客户端
    // 客户端收到后自动调用 OnRep_Health()
}

// ============================================
// OnRep_Health — 客户端收到血量更新
// ============================================
void AMyCharacter::OnRep_Health()
{
    // 💡 这个函数在客户端上被自动调用
    // 调用时机：客户端收到服务器发来的 Health 新值后

    // ===== 步骤1：更新血条 UI =====
    UpdateHealthUI();

    // ===== 步骤2：根据血量变化播放相应效果 =====
    if (Health <= 0)
    {
        // 角色死亡
        PlayDeathAnimation();
        // 禁用输入
        // DisableInput(nullptr);
    }
    else if (Health < 30.0f)
    {
        // 低血量警告（屏幕边缘闪烁红色）
        // ShowLowHealthWarning();
        PlayHitReactionAnimation();
    }

    // ===== 步骤3：记录日志 =====
    UE_LOG(LogTemp, Log, TEXT("客户端：血量更新为 %f"), Health);
}

// ============================================
// OnRep_Armor — 客户端收到护甲更新
// ============================================
void AMyCharacter::OnRep_Armor()
{
    UpdateArmorUI();
    UE_LOG(LogTemp, Log, TEXT("客户端：护甲更新为 %f"), Armor);
}

// ============================================
// OnRep_Ammo — 客户端收到弹药更新
// ============================================
void AMyCharacter::OnRep_Ammo()
{
    UpdateAmmoUI();

    // 弹药不足时播放提示音效
    if (Ammo <= 5 && Ammo > 0)
    {
        // PlayLowAmmoSound();
        UE_LOG(LogTemp, Warning, TEXT("客户端：弹药不足！剩余 %d"), Ammo);
    }
    else if (Ammo == 0)
    {
        // PlayOutOfAmmoSound();
        UE_LOG(LogTemp, Warning, TEXT("客户端：弹药耗尽！"));
    }
}

// ============================================
// OnRep_WeaponType — 客户端收到武器切换
// ============================================
void AMyCharacter::OnRep_WeaponType()
{
    // 切换武器模型和动画
    // SwitchToWeapon(CurrentWeaponType);
    // UpdateCrosshair(CurrentWeaponType);
    UE_LOG(LogTemp, Log, TEXT("客户端：切换武器到类型 %d"), CurrentWeaponType);
}

/// ============================================
// 辅助 UI 更新函数（客户端本地）
/// ============================================

void AMyCharacter::UpdateHealthUI()
{
    // 注意：UI 代码只在客户端运行
    // 伪代码：
    // float HealthPercent = Health / MaxHealth;
    // HealthBarWidget->SetPercent(HealthPercent);
    // HealthTextWidget->SetText(FString::Printf(TEXT("%.0f"), Health));
}

void AMyCharacter::UpdateArmorUI()
{
    // 伪代码：ArmorBarWidget->SetPercent(Armor / MaxArmor);
}

void AMyCharacter::UpdateAmmoUI()
{
    // 伪代码：AmmoTextWidget->SetText(FString::Printf(TEXT("%d"), Ammo));
}

void AMyCharacter::PlayHitReactionAnimation()
{
    // 播放受击动画（客户端本地播放）
    // PlayAnimMontage(HitReactionMontage);
}
```

### OnRep 的关键注意事项

```cpp
// ✅ 正确做法：OnRep 中只做客户端UI和表现层逻辑
void AMyCharacter::OnRep_Health()
{
    // ✅ 更新血条 UI
    UpdateHealthUI();

    // ✅ 播放受击动画
    PlayHitReactionAnimation();

    // ✅ 播放受击音效
    // PlayHitSound();

    // ✅ 根据血量切换材质（比如变得更红）
    // UpdateDamageMaterial();

    // ❌ 不要在这里修改其他同步属性！会导致死循环或数据不一致
    // Armor -= 10;   ← 错误！在客户端修改同步属性会被服务器覆盖
}

// ✅ 正确做法：OnRep 中区分初始化和更新
void AMyCharacter::OnRep_Ammo()
{
    // 在某些情况下，OnRep 在 Actor 初始化时也会被调用
    // 如果你需要区分"初次同步"和"后续更新"，可以这样判断：

    static bool bFirstTime = true;  // 注意：这只是一个简单的示例，
                                     // 复杂场景可能需要更精确的判断方式
    if (bFirstTime)
    {
        // 第一次收到同步数据 — 初始化 UI
        UpdateAmmoUI();
        bFirstTime = false;
    }
    else
    {
        // 后续更新 — 播放弹药变化的动画
        UpdateAmmoUI();
        // PlayAmmoChangedAnimation();
    }
}
```

---

## RPC 与属性同步的对比总结

### 什么时候用什么？

```cpp
// ============================================
// 使用 Server RPC 的场景：
// ============================================
// - 客户端请求执行一次性操作
// - 需要传递参数（执行位置、目标等）
// - 操作失败不需要特殊处理（开火请求被拒绝，不影响客户端状态）

// 示例：
UFUNCTION(Server, Reliable)
void ServerFireWeapon();                  // 开火
UFUNCTION(Server, Reliable)
void ServerInteractWithObject(AActor* Obj); // 交互
UFUNCTION(Server, Reliable)
void ServerCastAbility(int32 AbilityID);  // 施放技能

// ============================================
// 使用属性同步的场景：
// ============================================
// - 持续存在的状态（血量、分数、位置）
// - 新加入的玩家也需要知道当前状态
// - 需要自动同步，不需要手动调用

// 示例：
UPROPERTY(Replicated)
float Health;                             // 血量 — 持续状态
UPROPERTY(Replicated)
int32 TeamID;                             // 队伍 — 加入后需要知道
UPROPERTY(ReplicatedUsing = OnRep_Score)
int32 Score;                              // 分数 — 持续状态 + UI 更新

// ============================================
// 使用 Client RPC 的场景：
// ============================================
// - 服务器需要通知特定客户端
// - 一次性事件，不需要持久化
// - UI 提示、警告、特效

// 示例：
UFUNCTION(Client, Reliable)
void ClientShowMessage(const FString& Msg);  // 显示消息
UFUNCTION(Client, Reliable)
void ClientShowDamageNumber(float Damage);   // 伤害数字

// ============================================
// 使用 NetMulticast RPC 的场景：
// ============================================
// - 所有客户端都需要看到的一次性事件
// - 视觉效果、音效
// - 不需要持久化状态

// 示例：
UFUNCTION(NetMulticast, Reliable)
void MulticastPlayExplosion(FVector Loc);    // 爆炸特效
UFUNCTION(NetMulticast, Reliable)
void MulticastAnnounceKill(ACharacter* K, ACharacter* V); // 击杀广播
```

### 对比表

| 特性     | RPC                 | 属性同步                 |
| -------- | ------------------- | ------------------------ |
| 本质     | 函数调用            | 变量同步                 |
| 频率     | 一次性事件          | 持续性状态               |
| 新客户端 | 看不到历史 RPC 调用 | 能看到当前（最新）属性值 |
| 自动性   | 手动调用            | 服务器修改后自动同步     |
| 参数传递 | ✅ 可以传递复杂参数 | 只能同步属性值           |
| 典型用途 | 开火、跳跃、交互    | 血量、分数、位置、队伍   |

---

## 小结与检查清单

在本章中，你学到了：

1. **三种 RPC 类型**：Server（客户端→服务器）、Client（服务器→拥有者客户端）、NetMulticast（服务器→服务器和相关客户端）。
2. **Server RPC 的 \_Implementation 和 \_Validate**：`_Implementation` 是实际逻辑；只有声明了 `WithValidation` 时才需要 `_Validate`。
3. **Reliable vs Unreliable**：重要事件用 Reliable，高频更新用 Unreliable。
4. **属性同步**：`UPROPERTY(Replicated)` 和 `UPROPERTY(ReplicatedUsing=OnRep_Xxx)`。
5. **DOREPLIFETIME 和 DOREPLIFETIME_CONDITION**：注册同步属性，可选条件。
6. **OnRep 回调**：客户端收到同步数据后自动调用的函数。
7. **复制条件**：COND_OwnerOnly、COND_SkipOwner、COND_InitialOnly 等。

### 完成检查清单

请逐项确认你已经理解：

- [ ] 我能用自己的话解释 Server RPC、Client RPC、NetMulticast RPC 的区别。
- [ ] 我知道 Server RPC 的 `_Implementation` 在服务器执行，`WithValidation` 对应的 `_Validate` 用于参数验证。
- [ ] 我知道 Client RPC 只在"拥有者客户端"上执行。
- [ ] 我知道 NetMulticast RPC 只能从服务器调用。
- [ ] 我能说出 Reliable 和 Unreliable 各自的适用场景和原因。
- [ ] 我知道 `UPROPERTY(Replicated)` 的声明方法。
- [ ] 我知道 `UPROPERTY(ReplicatedUsing = OnRep_Xxx)` 的用法和 OnRep 回调的作用。
- [ ] 我知道 `GetLifetimeReplicatedProps` 中如何使用 `DOREPLIFETIME` 和 `DOREPLIFETIME_CONDITION`。
- [ ] 我能区分什么时候用 RPC，什么时候用属性同步。
- [ ] 我知道 `COND_OwnerOnly`、`COND_SkipOwner`、`COND_InitialOnly` 的含义。

如果你能全部打勾，你已经掌握了 UE5 的 RPC 和属性同步机制。接下来进入服务器权威与网络预测。
