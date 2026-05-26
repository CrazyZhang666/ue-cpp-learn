# 9.2 C++动画实例

> **目标**：学会在C++中创建UAnimInstance子类，计算动画参数并暴露给动画蓝图使用。

---

## 为什么需要C++的AnimInstance

回顾上一节的分工原则：**数据计算在C++，动画选择在蓝图**。这一节我们聚焦"数据计算"的部分。

核心优势：

- 访问C++角色类成员无需Cast（类型转换）
- 复杂数学运算（向量、旋转、插值）在C++中更快
- 可以在Tick中高效地每帧更新参数
- 代码重用：多个动画蓝图可以共用一个C++父类

---

## 创建你的第一个UAnimInstance子类

### 头文件

```cpp
// MyAnimInstance.h
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"      // AnimInstance的基类头文件
#include "MyAnimInstance.generated.h"    // ⚠️ 由UHT生成，必须最后include！

/**
 * 自定义动画实例类
 * 继承自 UAnimInstance，负责计算所有动画参数
 */
UCLASS()  // 标记为UE反射类
class MYPROJECT_API UMyAnimInstance : public UAnimInstance  // public继承
{
    GENERATED_BODY()  // 生成反射代码的宏，必须在类体最前面

public:
    // ===== 生命周期函数 =====

    // 初始化函数：动画蓝图创建时调用，只执行一次
    // 适合做"一次性"的设置，如缓存角色指针
    virtual void NativeInitializeAnimation() override;

    // 更新函数：每帧调用一次，在这里计算动画参数
    // DeltaSeconds = 上一帧到这一帧的间隔时间（秒）
    virtual void NativeUpdateAnimation(float DeltaSeconds) override;

protected:
    // ===== 动画参数（暴露给动画蓝图读取）=====

    // 角色的水平移动速度（单位：cm/s）
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float Speed;

    // 角色移动方向（相对于角色朝向的角度，单位：度）
    // 0 = 前方，90 = 右方，-90 = 左方，180/ -180 = 后方
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float Direction;

    // 角色是否在空中（跳跃/坠落）
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsInAir;

    // 角色是否在蹲伏
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsCrouching;

    // 角色是否在冲刺
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsSprinting;

    // 角色的垂直速度（正值=上升，负值=下落）
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float VerticalVelocity;

    // 是否有武器在手
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Combat")
    bool bHasWeapon;

    // 瞄准偏移量（用于混合空间，控制上半身瞄准方向）
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Aim")
    float AimPitch;  // 上下瞄准角度（俯仰）

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Aim")
    float AimYaw;    // 左右瞄准角度（偏航）
};
```

### 源文件

```cpp
// MyAnimInstance.cpp
#include "MyAnimInstance.h"
#include "GameFramework/Character.h"           // ACharacter的定义
#include "GameFramework/CharacterMovementComponent.h"  // 移动组件的定义
#include "Kismet/KismetMathLibrary.h"           // 数学工具函数

// ===== 初始化 =====
void UMyAnimInstance::NativeInitializeAnimation()
{
    // 调用父类初始化（这是一个好习惯，确保引擎内部的初始化也执行）
    Super::NativeInitializeAnimation();

    // 初始化参数为默认值（避免使用未初始化的变量）
    Speed = 0.0f;
    Direction = 0.0f;
    bIsInAir = false;
    bIsCrouching = false;
    bIsSprinting = false;
    VerticalVelocity = 0.0f;
    bHasWeapon = false;
    AimPitch = 0.0f;
    AimYaw = 0.0f;
}

// ===== 每帧更新 =====
void UMyAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    // 调用父类更新（必须！引擎内部有一些逻辑依赖这个调用）
    Super::NativeUpdateAnimation(DeltaSeconds);

    // ---- 第一步：获取拥有者角色 ----

    // TryGetPawnOwner() 返回这个动画实例绑定的Pawn（通常是ACharacter）
    // 如果角色不存在（如预览窗口或角色尚未生成），返回nullptr
    APawn* OwnerPawn = TryGetPawnOwner();
    if (!OwnerPawn)
    {
        // 安全返回：没有角色就什么都不做，用默认值
        return;
    }

    // ---- 第二步：计算基础移动参数 ----

    // 获取角色的速度向量（带方向和大小的量）
    FVector Velocity = OwnerPawn->GetVelocity();

    // Size2D() 获取水平面上的速度大小（忽略Z轴）
    // 结果单位是 cm/s（虚幻引擎的默认单位）
    Speed = Velocity.Size2D();

    // 判断是否在空中
    // ACharacter 有专门的 MovementComponent，其中的 IsFalling() 最准确
    ACharacter* OwnerCharacter = Cast<ACharacter>(OwnerPawn);
    if (OwnerCharacter)
    {
        // 从角色的移动组件获取"是否在空中"状态
        UCharacterMovementComponent* MovementComp = OwnerCharacter->GetCharacterMovement();
        if (MovementComp)
        {
            bIsInAir = MovementComp->IsFalling();

            // 是否蹲伏：CharacterMovement组件直接提供
            bIsCrouching = MovementComp->IsCrouching();
        }
    }

    // ---- 第三步：计算方向 ----

    // 方向 = 速度方向相对于角色朝向的夹角
    if (Speed > 10.0f)  // 只有移动时方向才有意义（避免静止时方向闪烁）
    {
        // 获取角色的朝向旋转
        FRotator ActorRotation = OwnerPawn->GetActorRotation();

        // 计算"速度方向在水平面上的旋转角"
        // Velocity.ToOrientationRotator() 把速度向量转成朝向角
        FRotator VelocityRotation = Velocity.ToOrientationRotator();

        // 计算两个旋转之间的差值（-180 到 180 度之间）
        // NormalizedDeltaRotator 保证结果在[-180, 180]范围内
        FRotator DeltaRotation = UKismetMathLibrary::NormalizedDeltaRotator(
            VelocityRotation,
            ActorRotation
        );

        // 取Yaw（偏航角）作为移动方向
        // 0 = 向前移动，90 = 向右移动，-90 = 向左移动，±180 = 向后移动
        Direction = DeltaRotation.Yaw;
    }
    else
    {
        // 静止状态下方向归零
        Direction = 0.0f;
    }

    // ---- 第四步：垂直速度（用于跳跃/坠落动画）----
    VerticalVelocity = Velocity.Z;

    // ---- 第五步：冲刺判断（简化为速度阈值）----
    // 实际项目中你可能需要从角色的"疾跑输入"来判断，这里用速度阈值演示
    // 一般来说，ACharacter的默认跑步速度约600 cm/s
    bIsSprinting = (Speed > 500.0f && !bIsInAir);
    //            ↑ 速度快          ↑ 而且必须在地面（空中不触发冲刺动画）

    // ---- 第六步：武器状态 ----
    // 这里假设你的角色类有 HasWeapon() 方法
    // 实际使用时替换为你自己的逻辑
    // bHasWeapon = OwnerCharacter->HasWeapon();
    // 演示用：暂时设为true
    bHasWeapon = true;

    // ---- 第七步：瞄准偏移 ----
    // 瞄准参数通常从ControlRotation获取（玩家视角方向）
    if (OwnerCharacter)
    {
        // 获取控制器的旋转（玩家的视角方向）
        FRotator ControlRotation = OwnerCharacter->GetControlRotation();
        FRotator ActorRotation = OwnerCharacter->GetActorRotation();

        // 计算视角相对于角色朝向的偏移
        FRotator AimDelta = UKismetMathLibrary::NormalizedDeltaRotator(
            ControlRotation,
            ActorRotation
        );

        AimPitch = AimDelta.Pitch;  // 上下看
        AimYaw = AimDelta.Yaw;      // 左右看
    }
}
```

---

## UPROPERTY修饰符详解（动画参数专用）

动画参数的UPROPERTY必须加上适当的修饰符才能在动画蓝图中被读取。

### 核心修饰符

```cpp
// 最基本的暴露方式 — 动画蓝图只能"读"
UPROPERTY(BlueprintReadOnly, Category = "Animation")
float Speed;

// 如果需要蓝图也能"写"（一般不推荐，除非有特殊需求）
UPROPERTY(BlueprintReadWrite, Category = "Animation")
float Speed;
```

### 修饰符速查

| 修饰符               | 含义                     | 动画参数用哪个                   |
| -------------------- | ------------------------ | -------------------------------- |
| `BlueprintReadOnly`  | 蓝图可读，不能改         | ✅ 推荐，动画蓝图只需读参数      |
| `BlueprintReadWrite` | 蓝图可读写               | ⚠️ 谨慎使用，避免蓝图改C++计算值 |
| `Category = "xxx"`   | 在蓝图中的分类名         | ✅ 按功能分组，方便查找          |
| `Transient`          | 不序列化（不保存到存档） | ✅ 动画参数每帧计算，无需保存    |
| `VisibleAnywhere`    | 编辑器中可见但不可编辑   | 调试时有用，可以看到当前值       |
| `EditAnywhere`       | 编辑器可编辑             | ❌ 动画参数不应手动编辑          |

---

## TryGetPawnOwner 详解

### 这个函数是做什么的

```cpp
APawn* TryGetPawnOwner() const;
```

`UAnimInstance` 总是关联到一个骨骼网格体组件。而骨骼网格体组件属于某个Pawn（通常是ACharacter）。`TryGetPawnOwner()` 就是获取这个Pawn的指针。

### 为什么叫 Try

`Try` 意味着"尝试"——它可能返回 `nullptr`。在以下场景它返回空：

- 动画蓝图在编辑器中预览时（没有真实的游戏角色）
- 角色正在被销毁
- 骨骼网格体尚未初始化完成

```cpp
// ❌ 危险：没有判空
void UMyAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    ACharacter* Owner = Cast<ACharacter>(TryGetPawnOwner());
    float Speed = Owner->GetVelocity().Size2D();  // 如果Owner是nullptr，崩溃！
}

// ✅ 安全：先判空
void UMyAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    APawn* OwnerPawn = TryGetPawnOwner();
    if (!OwnerPawn) return;  // 安全第一，没有角色就直接返回

    ACharacter* OwnerCharacter = Cast<ACharacter>(OwnerPawn);
    if (!OwnerCharacter) return;  // 双重保险

    // 到现在OwnerCharacter一定有效，放心使用
    Speed = OwnerCharacter->GetVelocity().Size2D();
}
```

---

## 常用动画参数详解

### Speed（移动速度）

```cpp
// 水平速度的大小，单位：cm/s
// 用途：驱动 Blend Space 的 X 轴，控制走/跑/冲刺的混合

Speed = OwnerPawn->GetVelocity().Size2D();
//                               ↑ Size2D 忽略Z轴，只取水平速度
// 如果你用 .Size()（三维长度），跳跃时速度会异常大
```

### Direction（移动方向）

```cpp
// 角色速度方向 相对于 角色面朝方向 的角度差
// 单位：度（-180 ~ 180）
// 用途：驱动 Blend Space 的 Y 轴，控制前后左右方向动画

// 0° = 向前移动，±90° = 横向移动，±180° = 向后移动
```

### bIsInAir（是否在空中）

```cpp
// 判断角色是否在空中
// 用途：状态机转换 → 空中时切换到跳跃/坠落动画

UCharacterMovementComponent* MoveComp = OwnerCharacter->GetCharacterMovement();
bIsInAir = MoveComp->IsFalling();
// IsFalling() 覆盖了：跳跃上升、跳跃下降、被击飞、掉落等所有离地情况
```

### bIsCrouching（是否蹲伏）

```cpp
// 判断角色是否蹲伏
// 用途：切换蹲伏动画、蹲伏移动动画

bIsCrouching = MoveComp->IsCrouching();
// 前提：角色的 NavMovement 中 bCanCrouch = true
```

### VerticalVelocity（垂直速度）

```cpp
// Z轴速度，单位：cm/s
// 正值 = 上升中（起跳阶段）
// 负值 = 下落中（坠落阶段）
// 用途：区分"正在跳起"和"正在落下"的动画

VerticalVelocity = OwnerPawn->GetVelocity().Z;

// 动画蓝图中可以这样判断：
// VerticalVelocity > 50  → 跳起动画
// VerticalVelocity < -50 → 坠落动画
```

---

## 动画曲线（Animation Curves）

### 什么是动画曲线

动画师可以在动画序列中嵌入"曲线数据"，在动画的每一帧记录一个浮点数值。C++可以在运行时读取这些曲线值。

```
一个"跑步"动画序列：
  时间轴：  0s    0.2s   0.4s   0.6s   0.8s   1.0s
  左脚落地曲线：  1.0   0.0    0.0    0.0    1.0    ← 只有脚落地瞬间=1
  速度曲线：      0.0   400    400    400    400     ← 全程约400cm/s
```

### 在C++中读取动画曲线

```cpp
// 在 NativeUpdateAnimation 中读取曲线值
void UMyAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);

    // GetCurveValue 的参数是曲线名称（和动画资源中定义的名称一致）
    // 返回当前播放动画在该时间点的曲线值，如果没有该曲线则返回0

    // 示例1：读取"脚落地"曲线
    float FootIKCurve = GetCurveValue(FName("FootIK"));
    // 当值为1.0时，表示脚正好踩在地上

    // 示例2：读取"速度修正"曲线
    float SpeedModifier = GetCurveValue(FName("SpeedMod"));
    // 可以用来在动画播放期间动态调整移动速度
}
```

### 动画曲线的用途

| 用途     | 曲线名（示例）         | 说明                    |
| -------- | ---------------------- | ----------------------- |
| 脚步检测 | FootStep_L, FootStep_R | 值为1时播放脚步音效     |
| IK控制   | FootIK_L, FootIK_R     | 控制IK权重              |
| 速度调整 | SpeedMod               | 动画驱动角色速度        |
| 伤害窗口 | DamageWindow           | 值为1时武器可以造成伤害 |
| 材质变化 | EmissivePower          | 控制发光材质亮度        |

---

## 动画通知的C++绑定

动画通知（AnimNotify）是动画序列特定时间点触发的事件。我们可以在C++中注册回调函数来响应这些通知。

> **注意**：动画通知的C++绑定在本节简要介绍，详细的AnimNotify创建和使用在 [下一节](./03-动画通知与蒙太奇.md) 中展开。

### 在AnimInstance中响应通知事件

```cpp
// MyAnimInstance.h

UCLASS()
class MYPROJECT_API UMyAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    // 收到任意AnimNotify时都会触发的回调
    // NotifyName = 通知名称，可以在AnimNotify编辑器中自定义
    virtual void AnimNotify_Name(FName NotifyName);

    // 以下是内置的通知事件（如果你用了相应的AnimNotifyState）

    // 当动画通知状态开始时调用
    virtual void AnimNotify_StateBegin(FName NotifyName, float TotalDuration, float CurrentTime);

    // 当动画通知状态结束时调用
    virtual void AnimNotify_StateEnd(FName NotifyName, float TotalDuration, float CurrentTime);
};
```

```cpp
// MyAnimInstance.cpp

void UMyAnimInstance::AnimNotify_Name(FName NotifyName)
{
    // 根据通知名称做不同处理
    if (NotifyName == FName("FootStep"))
    {
        // 播放脚步音效
        UE_LOG(LogTemp, Log, TEXT("脚步落地！触发音效"));
    }
    else if (NotifyName == FName("AttackHit"))
    {
        // 攻击命中检测
        UE_LOG(LogTemp, Log, TEXT("攻击命中检测窗口！"));
    }

    // 如果不想在蓝图中处理，可以不调Super
    // Super::AnimNotify_Name(NotifyName);
}

void UMyAnimInstance::AnimNotify_StateBegin(FName NotifyName, float TotalDuration, float CurrentTime)
{
    // 通知状态开始
    UE_LOG(LogTemp, Log, TEXT("通知状态 [%s] 开始，持续 %.2f 秒"), *NotifyName.ToString(), TotalDuration);
}

void UMyAnimInstance::AnimNotify_StateEnd(FName NotifyName, float TotalDuration, float CurrentTime)
{
    // 通知状态结束
    UE_LOG(LogTemp, Log, TEXT("通知状态 [%s] 结束"), *NotifyName.ToString());
}
```

---

## 完整代码文件汇总

### 最终的头文件（含所有常用参数）

```cpp
// MyAnimInstance.h
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "MyAnimInstance.generated.h"

/**
 * 角色动画实例类
 * 负责每帧计算动画参数，供动画蓝图的状态机和混合空间使用
 */
UCLASS()
class MYPROJECT_API UMyAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    virtual void NativeInitializeAnimation() override;
    virtual void NativeUpdateAnimation(float DeltaSeconds) override;

protected:
    // ---- 移动相关 ----
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float Speed;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float Direction;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsInAir;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsCrouching;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    bool bIsSprinting;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Movement")
    float VerticalVelocity;

    // ---- 战斗相关 ----
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Combat")
    bool bHasWeapon;

    // ---- 瞄准相关 ----
    UPROPERTY(BlueprintReadOnly, Category = "Animation|Aim")
    float AimPitch;

    UPROPERTY(BlueprintReadOnly, Category = "Animation|Aim")
    float AimYaw;
};
```

### 最终的源文件（含所有参数计算）

```cpp
// MyAnimInstance.cpp
#include "MyAnimInstance.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/KismetMathLibrary.h"

void UMyAnimInstance::NativeInitializeAnimation()
{
    Super::NativeInitializeAnimation();
    // 所有UPROPERTY会自动初始化为默认值（float=0.0, bool=false）
    // 这里显式初始化只是为了代码清晰
}

void UMyAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);

    // 1. 安全获取角色
    APawn* Owner = TryGetPawnOwner();
    if (!Owner) return;

    ACharacter* Character = Cast<ACharacter>(Owner);
    if (!Character) return;

    UCharacterMovementComponent* MoveComp = Character->GetCharacterMovement();
    if (!MoveComp) return;

    // 2. 速度
    FVector Velocity = Character->GetVelocity();
    Speed = Velocity.Size2D();         // 水平速度大小
    VerticalVelocity = Velocity.Z;     // 垂直速度

    // 3. 状态判断
    bIsInAir = MoveComp->IsFalling();        // 是否在空中
    bIsCrouching = MoveComp->IsCrouching();  // 是否蹲伏
    bIsSprinting = (Speed > 500.0f && !bIsInAir);  // 是否冲刺

    // 4. 方向计算
    if (Speed > 10.0f)
    {
        FRotator ActorRot = Character->GetActorRotation();
        FRotator VelocityRot = Velocity.ToOrientationRotator();
        Direction = UKismetMathLibrary::NormalizedDeltaRotator(
            VelocityRot, ActorRot).Yaw;
    }
    else
    {
        Direction = 0.0f;
    }

    // 5. 瞄准偏移
    FRotator ControlRot = Character->GetControlRotation();
    FRotator ActorRot2 = Character->GetActorRotation();
    FRotator AimDelta = UKismetMathLibrary::NormalizedDeltaRotator(
        ControlRot, ActorRot2);
    AimPitch = AimDelta.Pitch;
    AimYaw = AimDelta.Yaw;
}
```

---

## 在编辑器中把AnimBP绑定到C++ AnimInstance

```
操作步骤：
1. 创建新的动画蓝图：
   Content Browser 右键 → Animation → Animation Blueprint
2. 在弹出的窗口中选择：
   - Target Skeleton：选择你角色的骨架
   - Parent Class：选择 "MyAnimInstance"（你刚创建的C++类）
3. 命名：ABP_MyCharacter
4. 打开动画蓝图，在左侧"我的蓝图"面板中
   你会看到C++中定义的变量（Speed, Direction等）已经出现在列表中
5. 在事件图表中拖入这些变量即可使用
```

---

## 常见错误排查

### 编译错误

```cpp
// ❌ 忘记 #include "MyAnimInstance.generated.h"
// 报错："UCLASS not defined" 或 "GENERATED_BODY not defined"

// ❌ .generated.h 不在最后
#include "MyAnimInstance.generated.h"
#include "GameFramework/Character.h"  // 错误！必须放在generated.h之前
// 报错：各种奇怪的宏展开错误

// ✅ 正确顺序
#include "GameFramework/Character.h"  // 所有普通include在前面
#include "MyAnimInstance.generated.h"  // generated.h 在最后
```

### 运行时错误

```cpp
// ❌ TryGetPawnOwner() 后没有判空
// 表现：编辑器预览窗口中角色显示为T-Pose，Play后崩溃

// ❌ 在 NativeInitializeAnimation 中做每帧计算
// 表现：动画参数永远不变（因为只执行了一次）

// ❌ UPROPERTY 忘记 BlueprintReadOnly
// 表现：动画蓝图中看不到变量
```

### ✅ 检查清单

- [ ] `.generated.h` 在最后一行include
- [ ] 所有动画参数都有 `UPROPERTY(BlueprintReadOnly, Category = "...")`
- [ ] `NativeUpdateAnimation` 第一行调用了 `Super::NativeUpdateAnimation(DeltaSeconds)`
- [ ] `TryGetPawnOwner()` 返回后做了判空
- [ ] 速度使用 `Size2D()` 而非 `Size()`（排除Z轴干扰）
- [ ] 方向计算考虑了静止情况（Speed < 阈值时Direction=0）
- [ ] 创建动画蓝图时Parent Class选对了C++类

---

## 完成检查清单

学完本节后，试着回答：

- [ ] UAnimInstance的两个核心生命周期函数叫什么？分别什么时候调用？
- [ ] `TryGetPawnOwner()` 返回什么类型？为什么需要判空？
- [ ] 动画参数的UPROPERTY最少需要什么修饰符？
- [ ] 计算速度时为什么用 `Size2D()` 而不是 `Size()`？
- [ ] 方向（Direction）单位是什么？0、90、-90、180分别代表什么方向？
- [ ] `IsFalling()` 覆盖了哪些状态？和"跳跃"有什么区别？
- [ ] 动画曲线的 `GetCurveValue` 函数怎么使用？
- [ ] 如何在编辑器中将动画蓝图和C++ AnimInstance绑定？
- [ ] 写出一个完整的、生产可用的MyAnimInstance头文件（含所有常用参数）。
- [ ] 如果动画蓝图中看不到你的C++变量，可能是什么原因？

---

## 下一节

[9.3 动画通知与蒙太奇](./03-动画通知与蒙太奇.md) —— 学习如何创建自定义动画通知，以及动画蒙太奇（AnimMontage）的使用方法。
