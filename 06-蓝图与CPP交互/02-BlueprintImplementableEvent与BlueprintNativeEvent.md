# 6.2 BlueprintImplementableEvent 与 BlueprintNativeEvent

> **目标**：掌握两种"C++定义签名、蓝图实现逻辑"的函数类型，理解 \_Implementation 后缀的规则，学会根据项目需求选择正确的事件类型。

---

## 本章前置知识

在学习本章之前，你应该已经掌握：

- UFUNCTION 宏的基本用法（第3.4节）
- BlueprintCallable 和 BlueprintPure 的区别（上一节）
- C++ 的继承与多态概念（第2.4节）

---

## 1. 从调用方向理解事件类型

在蓝图和C++的交互中，"谁调用谁"是一个核心问题。我们可以从调用方向来理解三种事件类型：

```
                  C++ 调用 蓝图
                  ──────────────→
                  BlueprintImplementableEvent
                  BlueprintNativeEvent

蓝图 调用 C++
←──────────────
BlueprintCallable
BlueprintPure
```

本章重点讲的是**前两种**：C++调用蓝图的函数。让C++代码在某个时机说"嘿，蓝图那边有没有什么要做的？"

---

## 2. BlueprintImplementableEvent 详解

### 2.1 核心概念

`BlueprintImplementableEvent` 翻译过来是"蓝图可实现的函数"：

- **C++负责定义函数签名**（函数名、参数、返回值）——像是定一个"接口合同"
- **蓝图负责写具体实现**——像是签合同后的"具体执行方案"
- **C++中不写任何实现代码！**甚至连空的 `{}` 都不写
- **C++在合适的时机直接调用这个函数**——引擎会自动找到蓝图中的实现并执行

### 2.2 基本语法

```cpp
// ===== .h 头文件声明 =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MyActor.generated.h"

UCLASS(Blueprintable)  // Blueprintable允许蓝图继承这个类
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    // ===== BlueprintImplementableEvent 基础声明 =====

    // 【关键语法】只有声明，没有任何实现代码
    UFUNCTION(BlueprintImplementableEvent, Category = "MyActor|Events")
    void OnHealthChanged(float NewHealth, float OldHealth);
    //  ├─ 声明以分号";"结束，不写花括号{}
    //  ├─ .cpp文件中绝对不写这个函数的实现
    //  └─ 调用方式和普通函数完全一样

    UFUNCTION(BlueprintImplementableEvent, Category = "MyActor|Events")
    void OnPlayerDeath();

    UFUNCTION(BlueprintImplementableEvent, Category = "MyActor|Events")
    void OnItemCollected(FName ItemName, int32 ItemCount);
};
```

```cpp
// ===== .cpp 实现文件 =====
#include "MyActor.h"

// ⚠️ 注意：这里绝对不写 OnHealthChanged 的实现！
// ❌ 错误示范：
// void AMyActor::OnHealthChanged(float NewHealth, float OldHealth)
// {
//     // 不要写任何代码！
// }
// 如果写了实现，引擎会报错：函数已经由BlueprintImplementableEvent声明，不能再有C++实现。

// 使用时就像调用普通函数一样：
void AMyActor::TakeDamage(float Damage)
{
    float OldHealth = Health;  // 记录旧血量
    Health -= Damage;          // 更新血量
    //      ↓↓↓ 直接调用，引擎会自动找到蓝图中的实现 ↓↓↓
    OnHealthChanged(Health, OldHealth);  // 调用蓝图中的事件实现
}

void AMyActor::Die()
{
    // C++中触发死亡逻辑后，通知蓝图
    OnPlayerDeath();  // 如果蓝图中有实现，就会自动执行
}
```

### 2.3 蓝图端的操作步骤

**在C++中声明后，在蓝图中使用需要以下步骤：**

**步骤1**：编译C++代码（点击UE编辑器中的"编译"按钮）

**步骤2**：创建一个继承自 `AMyActor` 的蓝图类

- 在内容浏览器中右键 → 蓝图类 → 选择父类 `MyActor`

**步骤3**：打开蓝图，在事件图表中

- 右键菜单中搜索函数名（如 `OnHealthChanged`）
- 找到后拖入图表，它会自动作为一个**事件节点**出现

蓝图中的事件节点看起来像这样：

```
┌──────────────────────┐
│  Event OnHealthChanged │  ← 红色标题栏（事件节点）
│  ├─ NewHealth (Float)  │  ← 输入数据引脚
│  └─ OldHealth (Float)  │  ← 输入数据引脚
│                         │
│  [执行输出引脚] →        │  ← 从这里连线写你的蓝图逻辑
└──────────────────────┘
```

**步骤4**：编写蓝图逻辑

- 从执行输出引脚连线，可以连接：打印字符串、更新UI、播放音效等蓝图节点

**步骤5**：运行游戏

- 当C++中的 `TakeDamage` 被调用时，会自动触发蓝图中的 `OnHealthChanged` 事件

### 2.4 带返回值的 ImplementableEvent

BlueprintImplementableEvent **可以有返回值**，但使用时需要特别注意：

```cpp
// .h 声明
UFUNCTION(BlueprintImplementableEvent, Category = "MyActor|Events")
bool ShouldDestroyOnPickup();
//  └─ bool：返回值，蓝图中使用"Return Node"来设置返回值

UFUNCTION(BlueprintImplementableEvent, Category = "MyActor|Events")
float CalculateDamageMultiplier(AActor* Target);
```

```cpp
// .cpp 调用（像普通函数一样调用，接收返回值）
void AMyActor::TryPickup()
{
    // 调用蓝图事件，获取蓝图的返回值
    if (ShouldDestroyOnPickup())  // ← 蓝图返回true或false
    {
        Destroy();  // 蓝图说应该销毁，就销毁
    }
    else
    {
        // 蓝图说不应该销毁，做其他处理
        PlayPickupAnimation();
    }
}
```

> **⚠️ 重要提醒**：如果蓝图没有实现这个事件，调用有返回值的 ImplementableEvent 会返回**默认值**（bool返回false，int返回0，float返回0.0f，指针返回nullptr等）。因此需要做好检查处理。

### 2.5 完整示例：一个可交互的开关Actor

```cpp
// ===== SwitchActor.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SwitchActor.generated.h"

UCLASS(Blueprintable)
class MYPROJECT_API ASwitchActor : public AActor
{
    GENERATED_BODY()

public:
    ASwitchActor();

    // ----- 玩家触发开关（BlueprintCallable，蓝图中也能调用）-----
    UFUNCTION(BlueprintCallable, Category = "Switch")
    void Interact();

    // ----- 开关状态查询 -----
    UFUNCTION(BlueprintPure, Category = "Switch")
    bool IsActivated() const { return bIsActivated; }

protected:
    // ----- 蓝图实现的事件 -----

    // 开关被激活时触发（蓝图中写：播放开门动画等）
    UFUNCTION(BlueprintImplementableEvent, Category = "Switch|Events")
    void OnSwitchActivated();

    // 开关被关闭时触发（蓝图中写：播放在门动画等）
    UFUNCTION(BlueprintImplementableEvent, Category = "Switch|Events")
    void OnSwitchDeactivated();

    // 询问蓝图：是否允许激活？（蓝图中可根据条件阻止激活）
    UFUNCTION(BlueprintImplementableEvent, Category = "Switch|Events")
    bool CanActivate() const;

private:
    bool bIsActivated = false;  // 开关当前状态
};

// ===== SwitchActor.cpp =====
#include "SwitchActor.h"

ASwitchActor::ASwitchActor()
{
    // 构造函数中设置默认值
    PrimaryActorTick.bCanEverTick = false;  // 开关不需要每帧Tick
}

void ASwitchActor::Interact()
{
    if (bIsActivated)
    {
        // 当前是激活状态 → 去激活
        bIsActivated = false;
        OnSwitchDeactivated();  // ← C++调用蓝图事件：播放关闭动画
    }
    else
    {
        // 先问蓝图是否允许激活
        if (CanActivate())  // ← C++调用蓝图事件：蓝图中判定条件
        {
            bIsActivated = true;
            OnSwitchActivated();  // ← C++调用蓝图事件：播放激活动画
        }
        else
        {
            // 蓝图不允许激活（比如玩家没有钥匙）
            UE_LOG(LogTemp, Warning, TEXT("开关激活被蓝图拒绝"));
        }
    }
}
```

---

## 3. BlueprintNativeEvent 详解

### 3.1 核心概念

`BlueprintNativeEvent` 是 `BlueprintImplementableEvent` 的"进阶版"：

- **C++提供默认实现**——即使蓝图什么都不做，功能也能正常运行
- **蓝图可以可选地覆写**——如果蓝图需要定制化行为，可以覆盖C++的默认逻辑
- **调用时：蓝图优先**——如果蓝图覆写了，执行蓝图版本；否则执行C++默认版本

这好比：

- `ImplementableEvent` = "蓝图你必须写实现"（不写就什么都不发生）
- `NativeEvent` = "C++有默认方案，蓝图你可以选要不要改"

### 3.2 基本语法：\_Implementation 后缀规则

这是 BlueprintNativeEvent 最重要的规则，必须牢记：

```cpp
// ===== .h 头文件声明 =====
UCLASS(Blueprintable)
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    // 【声明】使用原始函数名
    UFUNCTION(BlueprintNativeEvent, Category = "MyActor|Events")
    void PlayHitReaction(FVector HitLocation, float DamageAmount);
    //  └─ 声明时用原始函数名：PlayHitReaction
};
```

```cpp
// ===== .cpp 实现文件 =====
#include "MyActor.h"

// 【实现】必须在函数名后加 _Implementation 后缀
//         ↓↓↓ 这是强制规则，不能省略 ↓↓↓
void AMyActor::PlayHitReaction_Implementation(FVector HitLocation, float DamageAmount)
//                           ──────────────
//  BlueprintNativeEvent的默认实现必须加 _Implementation 后缀
{
    // C++的默认实现：简单地播放一个受击动画蒙太奇
    UE_LOG(LogTemp, Log, TEXT("C++默认实现: 在位置(%s)播放受击动画，伤害=%.1f"),
           *HitLocation.ToString(), DamageAmount);

    // C++默认只做最基础的事情
    // 蓝图可以选择覆写，加上火花粒子特效、屏幕震动等
}

// 调用时：使用原始函数名，不加 _Implementation
void AMyActor::ApplyDamage(float Damage, FVector HitLocation)
{
    Health -= Damage;

    // 调用原始函数名，引擎会自动判断：
    // ┌─ 如果蓝图覆写了 → 调用蓝图版本
    // └─ 如果蓝图没覆写 → 调用 _Implementation C++默认版本
    PlayHitReaction(HitLocation, Damage);  // ← 注意是原始函数名！
}
```

### 3.3 编译器如何工作（理解内部机制）

当你声明 `BlueprintNativeEvent` 时，UHT（Unreal Header Tool）会生成以下代码（伪代码，帮助你理解）：

```cpp
// UHT自动生成的伪代码（你不需要写，理解即可）
void AMyActor::PlayHitReaction(FVector HitLocation, float DamageAmount)
{
    // 检查蓝图是否覆写了这个函数
    if (bHasBlueprintOverride_PlayHitReaction)
    {
        // 蓝图覆写了 → 执行蓝图版本
        ProcessEvent(FindFunctionChecked(TEXT("PlayHitReaction")), &Params);
    }
    else
    {
        // 蓝图没覆写 → 执行C++的 _Implementation 版本
        PlayHitReaction_Implementation(HitLocation, DamageAmount);
    }
}
```

这解释了为什么：

- 声明用原始函数名
- 实现用 `_Implementation` 后缀
- 调用用原始函数名（引擎帮你分派）

### 3.4 BlueprintNativeEvent 调用流程

```cpp
// 完整演示：C++中的调用流程

void AMyCharacter::OnDamaged(float Damage, const FDamageEvent& DamageEvent, AActor* Instigator)
{
    // 步骤1：更新血量
    float OldHealth = Health;
    Health -= Damage;

    // 步骤2：调用NativeEvent —— 注意这里是原始函数名
    // 引擎会自动检查蓝图是否覆写，选择执行
    PlayHitReaction(GetActorLocation(), Damage);
    //             ───────────────────────
    //  蓝图如果写了 → 蓝图版本可以加粒子特效、相机震动
    //  蓝图没写   → C++ _Implementation默认版本执行

    // 步骤3：检查死亡
    if (Health <= 0.0f)
    {
        OnDeath();  // 另一个事件
    }
}

// 默认实现
void AMyCharacter::PlayHitReaction_Implementation(FVector HitLocation, float DamageAmount)
{
    // 最简单的默认受击表现：打印一条日志
    UE_LOG(LogTemp, Warning, TEXT("默认受击: 伤害%.0f, 位置%s"),
           DamageAmount, *HitLocation.ToString());

    // 在实际项目中，这里可能会播放动画蒙太奇
    // PlayAnimMontage(HitReactionMontage);
}
```

### 3.5 蓝图端操作步骤

**对于 BlueprintNativeEvent，蓝图端可以：**

1. **不覆写**：完全不管，让C++默认实现生效（最简单）
2. **覆写**：在蓝图事件图表中添加这个事件并写逻辑

**覆写步骤：**

- 打开蓝图 → 事件图表 → 右键搜索函数名（如 `PlayHitReaction`）
- 会出现一个**覆盖（Override）**选项
- 选中后，事件节点出现在图表中
- 连线写你的蓝图逻辑
- 如果要调用父类（C++）的默认实现，右键节点选择"Add call to parent"

蓝图中的覆写节点：

```
┌─────────────────────────────┐
│  覆盖自 PlayHitReaction      │  ← 带"覆盖自"前缀
│  ├─ HitLocation (Vector)    │
│  └─ DamageAmount (Float)    │
│                              │
│  [父类: PlayHitReaction] →  │  ← 可选：调用C++默认实现
│                              │
│  [执行输出] →                │  ← 自己的额外蓝图逻辑
└─────────────────────────────┘
```

### 3.6 在蓝图中覆写时调用父类实现

这是一个常见模式：蓝图中做点额外的事，核心逻辑交给C++默认实现：

```cpp
// C++ 默认实现：播放基础受击动画
void AMyCharacter::PlayHitReaction_Implementation(FVector HitLocation, float DamageAmount)
{
    // 基础逻辑：播放动画
    if (HitReactionMontage)
    {
        PlayAnimMontage(HitReactionMontage);
    }
}
```

在蓝图中覆写时：

- 从 "父类: PlayHitReaction" 引脚连线 → C++默认动画照常播放
- 从 "执行输出" 引脚连线 → 蓝图中额外添加火花粒子、屏幕震动等
- 这样：动画由C++负责，特效由蓝图负责，各司其职

---

## 4. ImplementableEvent vs NativeEvent：决策指南

### 4.1 核心对比表

| 对比维度             | BlueprintImplementableEvent | BlueprintNativeEvent            |
| -------------------- | --------------------------- | ------------------------------- |
| C++默认实现          | ❌ 不允许                   | ✅ 必须有（`_Implementation`）  |
| 蓝图中不覆写         | 什么也不发生                | C++默认实现正常执行             |
| 蓝图中覆写后         | 完全取代（C++无实现可取代） | 取代C++默认实现                 |
| 是否可以调用父类实现 | ❌ 不能（因为C++没有实现）  | ✅ 可以（`Add call to parent`） |
| UHT生成函数体        | 空函数体                    | 检查蓝图→分派函数体             |
| 适用场景             | 纯表现层逻辑                | 有默认行为的逻辑                |

### 4.2 决策流程图

```
需要C++调用蓝图？
  │
  ├── C++需要提供默认行为吗？（蓝图不覆写也能正常运行）
  │     │
  │     ├── 是 → 用 BlueprintNativeEvent
  │     │        例子：PlayHitReaction(C++默认播放动画，蓝图加特效)
  │     │              CalculateDamage(C++默认公式，蓝图自定义公式)
  │     │
  │     └── 否 → 用 BlueprintImplementableEvent
  │              例子：OnLowHealth(纯UI表现，C++不需要知道怎么做)
  │                    OnItemCollected(蓝图做特效，C++只通知)
```

### 4.3 实战决策示例

```cpp
UCLASS(Blueprintable)
class MYPROJECT_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ===== BlueprintNativeEvent：有C++默认逻辑 =====

    // ✅ NativeEvent：C++有基础受击逻辑（播放动画）
    // 蓝图可选覆写：加粒子特效、相机震动
    UFUNCTION(BlueprintNativeEvent, Category = "Character|Combat")
    void PlayHitReaction(FVector HitDirection, float DamageAmount);

    // ✅ NativeEvent：C++有默认伤害计算公式
    // 蓝图可选覆写：加自定义伤害修正
    UFUNCTION(BlueprintNativeEvent, Category = "Character|Combat")
    float CalculateFinalDamage(float RawDamage, AActor* Target);

    // ✅ NativeEvent：C++有基础拾取逻辑（添加到背包）
    // 蓝图可选覆写：加拾取动画和音效
    UFUNCTION(BlueprintNativeEvent, Category = "Character|Inventory")
    bool TryPickupItem(class AItemActor* Item);

    // ===== BlueprintImplementableEvent：纯蓝图表现 =====

    // ✅ ImplementableEvent：血量低时UI警告，纯蓝图表现
    // C++只负责在适当时机触发，不关心蓝图怎么表现
    UFUNCTION(BlueprintImplementableEvent, Category = "Character|Events")
    void OnLowHealthWarning();

    // ✅ ImplementableEvent：升级时的特效，纯蓝图表现
    UFUNCTION(BlueprintImplementableEvent, Category = "Character|Events")
    void OnLevelUp(int32 NewLevel);

    // ✅ ImplementableEvent：任务完成通知，纯蓝图表现
    UFUNCTION(BlueprintImplementableEvent, Category = "Character|Events")
    void OnQuestCompleted(FName QuestID);
};
```

---

## 5. 参数传递和返回值处理

### 5.1 ImplementableEvent 的参数规则

```cpp
// ✅ 所有参数类型都支持
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnDamageReceived(float Damage, AActor* Instigator, FVector HitLocation,
                      const FHitResult& HitResult, bool bIsCriticalHit);
//                    ──┬──  ──────┬──────  ──────┬──────
//                      │          │              │
//      基本类型(float)  │    对象指针(AActor*)   结构体引用(const FHitResult&)
//                       │
//                      枚举、FString、FName、自定义USTRUCT等都支持

// ✅ 引用参数在蓝图中表现为输入/输出
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void ProcessRewards(int32 Experience, int32& OutGold, TArray<FName>& OutUnlockedAbilities);
//                                    ─────┬─────      ───────────┬───────────
//                         引用参数 = 蓝图输出引脚   引用参数 = 蓝图输出引脚
```

### 5.2 NativeEvent 的参数规则

NativeEvent 的参数规则和 ImplementableEvent 完全相同。唯一的区别是：**你在 `_Implementation` 函数中可以使用和修改任何参数**：

```cpp
// .h声明
UFUNCTION(BlueprintNativeEvent, Category = "Combat")
float CalculateDamage(float RawDamage, AActor* Target);

// .cpp默认实现
float AMyCharacter::CalculateDamage_Implementation(float RawDamage, AActor* Target)
{
    // 参数全部可用
    UE_LOG(LogTemp, Log, TEXT("计算伤害: 原始=%f, 目标=%s"),
           RawDamage, *GetNameSafe(Target));

    // C++默认：简单的50%护甲减伤
    float ArmorReduction = 0.5f;
    float FinalDamage = RawDamage * ArmorReduction;

    // 验证合法性
    return FMath::Max(FinalDamage, 0.0f);  // 确保伤害不为负
}
```

### 5.3 返回值的"默认值"陷阱

```cpp
// ImplementableEvent的返回值 —— 如果蓝图没实现，返回默认值
UFUNCTION(BlueprintImplementableEvent)
bool IsAllowedToEnter(AActor* Entrant);
// 如果蓝图没实现这个事件，调用返回false（bool的默认值）

// NativeEvent的返回值 —— 如果蓝图没覆写，返回_Implementation的计算结果
UFUNCTION(BlueprintNativeEvent)
float GetDamageMultiplier();
// 如果蓝图没覆写，调用 _Implementation 返回的值

// ⚠️ 因此在C++中使用ImplementableEvent的返回值时，必须考虑"蓝图没实现"的情况
void AMyActor::TryEnter(AActor* Entrant)
{
    // 注意：如果蓝图没实现IsAllowedToEnter，它会默认返回false
    // 这可能不符合你的预期！
    if (IsAllowedToEnter(Entrant))
    {
        AllowEntry(Entrant);
    }
    else
    {
        // 如果蓝图没实现这个事件，总会走到这里
        DenyEntry(Entrant);
    }
}

// ✅ 更好的做法：使用NativeEvent提供默认允许策略
UFUNCTION(BlueprintNativeEvent)
bool IsAllowedToEnter(AActor* Entrant);
bool AMyActor::IsAllowedToEnter_Implementation(AActor* Entrant)
{
    return true;  // C++默认：允许所有人进入
    // 蓝图可以覆写：添加特定条件限制
}
```

---

## 6. 多态在蓝图事件中的体现

### 6.1 虚函数表 + 蓝图覆写 = 灵活的多态

NativeEvent 本质上是UE对C++虚函数机制的扩展。它允许蓝图层也参与多态分派：

```cpp
// ===== 基类：CharacterBase.h =====
UCLASS(Blueprintable)
class MYPROJECT_API ACharacterBase : public ACharacter
{
    GENERATED_BODY()

public:
    // 角色受到伤害时的受击表现 —— NativeEvent，有默认实现
    UFUNCTION(BlueprintNativeEvent, Category = "Character")
    void PlayHitReaction(FVector HitDirection, float Damage);
    // C++默认实现：播放通用的人类受击动画

    virtual void PlayHitReaction_Implementation(FVector HitDirection, float Damage);
    //       ──── 注意加了virtual ────
    // 允许C++子类也覆写 _Implementation

    // 角色死亡时的处理 —— ImplementableEvent，每种子类自己在蓝图中定义
    UFUNCTION(BlueprintImplementableEvent, Category = "Character")
    void OnDeathSequence();
};

// ===== 子类1：Warrior.h（战士，C++子类）=====
UCLASS(Blueprintable)
class MYPROJECT_API AWarrior : public ACharacterBase
{
    GENERATED_BODY()

public:
    // C++子类覆写基类的NativeEvent默认实现
    virtual void PlayHitReaction_Implementation(FVector HitDirection, float Damage) override;
    //                          ──────────────                    ──────
    //          仍然是 _Implementation                           标准C++覆写关键字
    // 战士的默认受击反应：举起盾牌的动画
};

// ===== 子类2：WarriorBlueprint（战士的蓝图子类）=====
// 在编辑器中创建一个继承自AWarrior的蓝图类 BP_WarriorArmored
// 在蓝图中覆写 PlayHitReaction → 在护盾动画基础上再加金色粒子特效

// ===== 子类3：Mage（法师，纯蓝图类）=====
// 编辑器创建 BP_Mage 继承自 ACharacterBase
// 蓝图中覆写 PlayHitReaction → 法师没有护盾，闪烁半透明
// 蓝图中覆写 OnDeathSequence → 碎裂成光点消失
```

### 6.2 调用链追踪

当对一个 `ACharacterBase*` 指针调用 `PlayHitReaction` 时：

```
指针类型 ACharacterBase* → 实际指向 BP_Mage 实例

调用 PlayHitReaction(HitDir, Damage)
  │
  ├─ 引擎检查：BP_Mage覆写了这个NativeEvent吗？
  │     │
  │     ├─ 如果覆写 → 执行BP_Mage的蓝图版本（闪烁半透明）
  │     │
  │     └─ 如果没覆写 → 执行 _Implementation
  │           │
  │           └─ C++多态：ACharacterBase::_Implementation? → AWarrior::_Implementation?
  │                 └─ 取决于实际的C++类型
```

这就是NativeEvent的强大之处：**同时支持C++多态链和蓝图覆写链**。

---

## 7. 实践示例：可扩展的技能系统基类

### 7.1 设计思路

我们要创建一个技能基类，让**C++程序员**和**蓝图设计师**可以各自发挥所长：

- C++程序员负责：核心底层逻辑（资源消耗、冷却计算、伤害公式）
- 蓝图设计师负责：视觉表现（特效、动画、音效）

### 7.2 完整代码

```cpp
// ===== SkillBase.h =====
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "SkillBase.generated.h"

// 技能释放结果枚举
UENUM(BlueprintType)
enum class ESkillResult : uint8
{
    Success             UMETA(DisplayName = "释放成功"),
    Failed_OnCooldown   UMETA(DisplayName = "失败：冷却中"),
    Failed_NoMana       UMETA(DisplayName = "失败：法力不足"),
    Failed_InvalidTarget UMETA(DisplayName = "失败：无效目标"),
    Failed_Interrupted  UMETA(DisplayName = "失败：被中断"),
};

/**
 * 技能基类 — 所有技能（无论C++还是蓝图创建）的抽象基类
 *
 * 设计原则：
 * - C++负责核心逻辑：冷却、消耗、伤害计算
 * - 蓝图负责视觉表现：特效、动画、音效
 * - NativeEvent 作为C++和蓝图的"分界线"
 */
UCLASS(Blueprintable, BlueprintType, Abstract)
//      ────────────  ────────────        ──────
//  可以被蓝图继承    可作为蓝图变量类型    抽象类，不能直接生成实例
class MYPROJECT_API USkillBase : public UObject
{
    GENERATED_BODY()

public:
    USkillBase();

    // =============================================================
    // 公共接口 (BlueprintCallable) — 蓝图可以调用
    // =============================================================

    // 尝试释放技能（主入口函数）
    UFUNCTION(BlueprintCallable, Category = "Skill")
    ESkillResult TryActivateSkill(AActor* Caster, AActor* Target);

    // 查询技能是否可用
    UFUNCTION(BlueprintPure, Category = "Skill")
    bool IsSkillReady(AActor* Caster) const;

    // 获取冷却剩余时间
    UFUNCTION(BlueprintPure, Category = "Skill")
    float GetCooldownRemaining(AActor* Caster) const;

    // 获取冷却百分比（用于UI进度条）
    UFUNCTION(BlueprintPure, Category = "Skill")
    float GetCooldownPercent(AActor* Caster) const;

    // =============================================================
    // BlueprintNativeEvent — C++有默认逻辑，蓝图可选覆写
    // =============================================================

    // 计算技能造成的伤害（C++默认：简单的攻击力*倍率）
    UFUNCTION(BlueprintNativeEvent, Category = "Skill|Combat")
    float CalculateDamage(AActor* Caster, AActor* Target);
    // C++默认实现：Damage = Caster.AttackPower * SkillMultiplier

    // 检查释放条件（C++默认：检查法力消耗）
    UFUNCTION(BlueprintNativeEvent, Category = "Skill|Validation")
    bool CheckActivationConditions(AActor* Caster, AActor* Target);
    // C++默认实现：检查法力、检查目标非空

    // 应用技能效果到目标（C++默认：扣除目标血量）
    UFUNCTION(BlueprintNativeEvent, Category = "Skill|Combat")
    void ApplySkillEffect(AActor* Caster, AActor* Target, float Damage);

    // =============================================================
    // BlueprintImplementableEvent — C++无实现，纯蓝图表观
    // =============================================================

    // 技能释放时的视觉表现（蓝图：播放施法动画、粒子特效）
    UFUNCTION(BlueprintImplementableEvent, Category = "Skill|Visual")
    void OnSkillCast(AActor* Caster);

    // 技能命中目标时的视觉表现（蓝图：播放命中特效）
    UFUNCTION(BlueprintImplementableEvent, Category = "Skill|Visual")
    void OnSkillHit(AActor* Caster, AActor* Target, FVector HitLocation);

    // 技能完成后的表现（蓝图：播放收招动画、冷却图标刷新）
    UFUNCTION(BlueprintImplementableEvent, Category = "Skill|Visual")
    void OnSkillComplete(AActor* Caster);

    // 技能释放失败时的表现（蓝图：UI提示法力不足/冷却中）
    UFUNCTION(BlueprintImplementableEvent, Category = "Skill|Visual")
    void OnSkillFailed(AActor* Caster, ESkillResult FailReason);

protected:
    // =============================================================
    // 可配置的属性（子类可以在编辑器中修改）
    // =============================================================

    // 技能名称（蓝图子类的编辑器中显示中文名）
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Skill|Info",
              meta = (DisplayName = "技能名称"))
    FText SkillName;

    // 技能冷却时间（秒）
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Skill|Cooldown",
              meta = (DisplayName = "冷却时间", ClampMin = "0.0"))
    float CooldownDuration = 5.0f;

    // 法力消耗
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Skill|Cost",
              meta = (DisplayName = "法力消耗", ClampMin = "0.0"))
    float ManaCost = 20.0f;

    // 伤害倍率
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Skill|Combat",
              meta = (DisplayName = "伤害倍率", ClampMin = "0.0"))
    float DamageMultiplier = 1.5f;

    // 最近一次释放时间（内部追踪冷却用）
    float LastActivationTime = -9999.0f;
};

// ===== SkillBase.cpp =====
#include "SkillBase.h"
#include "GameFramework/Actor.h"
#include "Engine/World.h"

USkillBase::USkillBase()
{
    // 技能默认属性可在构造函数中设置，也可在蓝图中覆盖
}

// ===== 主入口：尝试释放技能 =====
ESkillResult USkillBase::TryActivateSkill(AActor* Caster, AActor* Target)
{
    // 步骤1：检查冷却时间
    if (!IsSkillReady(Caster))
    {
        float Remaining = GetCooldownRemaining(Caster);
        UE_LOG(LogTemp, Warning, TEXT("技能[%s]冷却中，剩余%.1f秒"), *SkillName.ToString(), Remaining);

        // 通知蓝图：技能释放失败（冷却中）
        OnSkillFailed(Caster, ESkillResult::Failed_OnCooldown);
        //               ─────────────────
        // ImplementableEvent：蓝图可以在这里弹出"冷却中"UI提示
        return ESkillResult::Failed_OnCooldown;
    }

    // 步骤2：检查释放条件（调用NativeEvent，让蓝图有机会添加额外条件）
    if (!CheckActivationConditions(Caster, Target))
    //    ───────────────────────────
    //  NativeEvent：C++默认检查法力，蓝图可以加"不能对队友释放"等条件
    {
        OnSkillFailed(Caster, ESkillResult::Failed_NoMana);
        return ESkillResult::Failed_NoMana;
    }

    // 步骤3：播放施法表现（ImplementableEvent，纯蓝图负责）
    OnSkillCast(Caster);
    //           ──────
    // 蓝图：播放施法动画、吟唱粒子特效、施法音效

    // 步骤4：计算伤害（NativeEvent，蓝图可以覆写伤害公式）
    float FinalDamage = CalculateDamage(Caster, Target);
    //                   ──────────────
    //  C++默认：AttackPower * SkillMultiplier
    //  蓝图覆写：可以加上属性修正、暴击判定等

    // 步骤5：应用效果（NativeEvent，蓝图可以覆写效果）
    ApplySkillEffect(Caster, Target, FinalDamage);
    //                 ────────────────
    // C++默认：扣除目标血量
    // 蓝图覆写：可以加上击退效果、眩晕等

    // 步骤6：播放命中表现（ImplementableEvent，纯蓝图负责）
    OnSkillHit(Caster, Target, Target->GetActorLocation());
    //          ─────────
    // 蓝图：播放命中粒子爆炸特效、命中音效

    // 步骤7：播放完成表现（ImplementableEvent，纯蓝图负责）
    OnSkillComplete(Caster);
    //               ──────
    // 蓝图：播放收招动画、刷新UI

    // 步骤8：更新冷却时间
    UWorld* World = Caster->GetWorld();
    if (World)
    {
        LastActivationTime = World->GetTimeSeconds();  // 记录当前时间作为释放时间
    }

    return ESkillResult::Success;
}

// ===== NativeEvent 默认实现 =====

float USkillBase::CalculateDamage_Implementation(AActor* Caster, AActor* Target)
//                          ────────────── ← 注意 _Implementation 后缀
{
    // C++默认伤害公式：简单的固定值 * 倍率
    // 在实际项目中，这里会从Caster读取AttackPower属性
    float BaseAttack = 100.0f;  // 默认攻击力
    float RawDamage = BaseAttack * DamageMultiplier;

    UE_LOG(LogTemp, Log, TEXT("技能[%s] C++默认伤害计算: %.1f"),
           *SkillName.ToString(), RawDamage);

    return RawDamage;
}

bool USkillBase::CheckActivationConditions_Implementation(AActor* Caster, AActor* Target)
{
    // C++默认检查1：目标不能为空
    if (!Target)
    {
        UE_LOG(LogTemp, Warning, TEXT("技能[%s]释放失败：目标为空"), *SkillName.ToString());
        return false;
    }

    // C++默认检查2：目标不能是自己
    if (Caster == Target)
    {
        UE_LOG(LogTemp, Warning, TEXT("技能[%s]释放失败：不能对自己释放"), *SkillName.ToString());
        return false;
    }

    // C++默认检查3：法力是否足够（在此示例中法力是成员变量，实际项目中可能需要从Caster读取）
    // 这里简化处理：总是返回true
    // 蓝图可以覆写添加更复杂的条件

    return true;
}

void USkillBase::ApplySkillEffect_Implementation(AActor* Caster, AActor* Target, float Damage)
{
    // C++默认效果：对目标造成伤害（使用UE的伤害系统）
    if (Target && Caster)
    {
        // 创建伤害事件
        FDamageEvent DamageEvent;
        // ApplyDamage 接受: 目标Actor, 伤害值, 伤害事件控制器, 造成伤害者, 伤害来源
        Target->TakeDamage(Damage, DamageEvent, nullptr, Caster);

        UE_LOG(LogTemp, Log, TEXT("技能[%s]对[%s]造成%.1f点伤害"),
               *SkillName.ToString(), *Target->GetName(), Damage);
    }
}

// ===== 纯查询函数 =====

bool USkillBase::IsSkillReady(AActor* Caster) const
{
    UWorld* World = Caster->GetWorld();
    if (!World)
    {
        return false;  // 没有有效的World，无法判断
    }

    float CurrentTime = World->GetTimeSeconds();
    float TimeSinceLastUse = CurrentTime - LastActivationTime;
    //                       当前时间减去上次释放时间 = 已经过了多久

    return TimeSinceLastUse >= CooldownDuration;
    //     已经过的时间 >= 冷却时间 → 冷却完成，可以使用
}

float USkillBase::GetCooldownRemaining(AActor* Caster) const
{
    UWorld* World = Caster->GetWorld();
    if (!World)
    {
        return 0.0f;
    }

    float CurrentTime = World->GetTimeSeconds();
    float TimeSinceLastUse = CurrentTime - LastActivationTime;
    float Remaining = CooldownDuration - TimeSinceLastUse;

    return FMath::Max(Remaining, 0.0f);  // 不返回负数
}

float USkillBase::GetCooldownPercent(AActor* Caster) const
{
    if (CooldownDuration <= 0.0f)
    {
        return 0.0f;  // 没有冷却时间，始终为0%
    }

    return GetCooldownRemaining(Caster) / CooldownDuration;
    //     剩余冷却秒数 / 总冷却秒数 = 冷却进度百分比（1.0 = 刚开始冷却, 0.0 = 冷却完成）
}
```

### 7.3 蓝图端创建新技能

在C++代码编译后，蓝图设计师可以这样创建新技能：

1. 右键内容浏览器 → 蓝图类 → 选择父类 `SkillBase`
2. 命名：`BP_FireballSkill`
3. 打开蓝图，在Class Defaults中设置：
   - 技能名称 = "火球术"
   - 冷却时间 = 8.0（秒）
   - 法力消耗 = 35.0
   - 伤害倍率 = 2.0
4. 在事件图表中覆写以下事件：
   - `OnSkillCast` → 添加施法动画蒙太奇 + 火焰粒子特效
   - `OnSkillHit` → 添加爆炸粒子 + 地面灼烧贴花
   - `OnSkillComplete` → 播放收招动画
   - `OnSkillFailed` → 播放"法力不足"提示
5. 可选：覆写 `CalculateDamage` → 加入暴击判定逻辑

---

## 8. 易错点总结

### 8.1 最常犯的错误

```cpp
// ❌ 错误1：为 ImplementableEvent 写了实现
UFUNCTION(BlueprintImplementableEvent)
void OnDamage();
void AMyActor::OnDamage()  // ❌ 编译错误！不能有实现
{
    // ...
}

// ❌ 错误2：NativeEvent 声明时用了 _Implementation
UFUNCTION(BlueprintNativeEvent)
void PlayHitReaction_Implementation(FVector Dir);  // ❌ 声明时不能加 _Implementation

// ✅ 正确：声明时用原始名
UFUNCTION(BlueprintNativeEvent)
void PlayHitReaction(FVector Dir);
// .cpp实现时加 _Implementation
void AMyActor::PlayHitReaction_Implementation(FVector Dir) { }

// ❌ 错误3：调用时用了 _Implementation
void AMyActor::TakeDamage(float Dmg)
{
    PlayHitReaction_Implementation(HitDir, Dmg);  // ❌ 绕过了蓝图覆写！
}

// ✅ 正确：调用时用原始名
void AMyActor::TakeDamage(float Dmg)
{
    PlayHitReaction(HitDir, Dmg);  // ✅ 引擎会自动选择蓝图版本或C++版本
}

// ❌ 错误4：BlueprintNativeEvent 的 _Implementation 忘了写
// .h中声明了
UFUNCTION(BlueprintNativeEvent)
void DoSomething();
// .cpp中忘了写 DoSomething_Implementation → 链接错误

// ❌ 错误5：在实现文件中不声明 virtual/override
// 如果要在C++子类中覆写父类的NativeEvent：
class AParent : public AActor
{
    UFUNCTION(BlueprintNativeEvent)
    void DoSomething();
};

class AChild : public AParent
{
    // ✅ 覆写时加 virtual 和 override
    virtual void DoSomething_Implementation() override;
    // ❌ 不加的话，调用的还是父类的实现
};
```

### 8.2 最佳实践速查

| 场景                                    | 推荐做法                                          |
| --------------------------------------- | ------------------------------------------------- |
| 纯视觉表现（音效、特效、动画）          | `BlueprintImplementableEvent`                     |
| 核心逻辑 + 可选定制（伤害公式、AI决策） | `BlueprintNativeEvent`                            |
| 不确定蓝图是否需要覆写                  | `BlueprintNativeEvent`（给默认行为更安全）        |
| 需要在C++子类中覆写默认实现             | `BlueprintNativeEvent` + 加 `virtual`             |
| 多个蓝图子类各自表现不同                | `BlueprintImplementableEvent`（每个子类各自实现） |

---

## 完成检查清单

- [ ] 理解 BlueprintImplementableEvent（无C++实现。蓝图必须实现）和 BlueprintNativeEvent（有C++默认实现。蓝图可选覆盖）的区别
- [ ] 知道 BlueprintNativeEvent 的声明用原始函数名，实现用 `_Implementation` 后缀
- [ ] 知道调用 BlueprintNativeEvent 时用原始函数名（不要加 `_Implementation`）
- [ ] 能根据场景正确选择 ImplementableEvent 还是 NativeEvent
- [ ] 理解 ImplementableEvent 不实现时返回值是默认值（有潜在风险）
- [ ] 知道如何在蓝图覆写 NativeEvent 时 "Add call to parent"
- [ ] 了解如何在C++子类中覆写父类的 NativeEvent（加 virtual 和 override）
- [ ] 能够搭建类似"技能系统"这种混合C++和蓝图的架构
- [ ] 清楚参数传递和返回值在两个事件类型中的行为
