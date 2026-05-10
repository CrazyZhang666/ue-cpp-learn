# 6.1 BlueprintCallable 与 BlueprintPure

> **目标**：彻底掌握如何让蓝图调用C++函数，理解BlueprintCallable和BlueprintPure的核心区别，学会函数参数传递的正确方式。

---

## 本章前置知识

在学习本章之前，你应该已经掌握：

- UFUNCTION宏的基本写法（第3.4节）
- UPROPERTY的基本用法（第3.3节）
- C++函数的参数传递：值传递、引用传递、const限定符（第2.5节）

如果你对以上内容还不熟悉，请先回去复习相关章节。

---

## 1. BlueprintCallable 的完整解析

### 1.1 什么是 BlueprintCallable？

`BlueprintCallable` 是 UFUNCTION 最重要的说明符之一。它的作用是：**把一个C++函数暴露给蓝图，让蓝图可以像调用蓝图函数一样调用它。**

```cpp
// .h 头文件中的声明
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MyActor.generated.h"  // 必须是最后一个include，由UHT生成

UCLASS(BlueprintType)  // BlueprintType让这个类可以在蓝图中作为变量类型使用
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()  // UE反射系统必需的宏，告诉UHT生成反射代码

public:
    // ===== BlueprintCallable 基础声明 =====

    // 【写法】BlueprintCallable + Category
    // Category参数用于在蓝图右键菜单中组织函数，方便查找
    UFUNCTION(BlueprintCallable, Category = "MyActor|Combat")
    //  ├─ BlueprintCallable：告诉UE将此函数暴露给蓝图
    //  └─ Category：在蓝图中右键搜索时的分类路径，"|"表示子分类
    void TakeDamage(float DamageAmount);
    //   ├─ void：无返回值
    //   └─ float DamageAmount：一个float类型的输入参数
};
```

```cpp
// .cpp 实现文件
#include "MyActor.h"

// BlueprintCallable的实现和普通C++函数完全一样，没有特殊要求
void AMyActor::TakeDamage(float DamageAmount)
{
    // 验证参数有效性（防御性编程的好习惯）
    if (DamageAmount <= 0.0f)
    {
        return;  // 伤害值无效，直接返回
    }

    Health -= DamageAmount;  // 扣除血量

    // 打印日志方便调试
    UE_LOG(LogTemp, Log, TEXT("受到 %f 点伤害，剩余血量 %f"), DamageAmount, Health);

    // 检查是否死亡
    if (Health <= 0.0f)
    {
        OnDeath();  // 调用死亡处理函数
    }
}
```

### 1.2 在蓝图中调用 BlueprintCallable 函数

创建好上述C++代码并编译后，打开蓝图编辑器，你会在以下位置找到 `TakeDamage`：

1. **事件图表**：右键空白处搜索 "Take Damage"，找到后拖入图表
2. **分类菜单**：`MyActor` → `Combat` → `TakeDamage`

这个函数在蓝图中表现为一个**有执行引脚的节点**：

```
[执行输入] → TakeDamage → [执行输出]
              DamageAmount [输入引脚]
```

- **白色执行引脚**：表示这是一个有执行流的函数（不是纯函数）
- **数据引脚**：`DamageAmount` 显示为输入数据引脚

---

## 2. BlueprintPure 的详细解析

### 2.1 什么是 BlueprintPure？

`BlueprintPure` 声明一个**纯函数**——在蓝图中表现为**没有执行引脚的绿色节点**。它只能读取数据、计算并返回值，**绝对不能修改任何成员变量的状态**。

```cpp
// .h 头文件
UCLASS(BlueprintType)
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    // ===== BlueprintPure 的正确声明 =====

    // 【关键规则1】BlueprintPure 函数必须用 const 修饰
    //     const 表示"这个函数不会修改对象的任何成员变量"
    UFUNCTION(BlueprintPure, Category = "MyActor|Stats")
    float GetHealthPercent() const;  // ← 注意末尾的const，绝对不能省略！
    //   ├─ float：返回值类型，任何UE支持的类型都可以
    //   └─ const：const修饰符是规矩，不是可选项

    // 【关键规则2】BlueprintPure 可以有参数，但不能修改它们
    UFUNCTION(BlueprintPure, Category = "MyActor|Stats")
    bool IsHealthBelowThreshold(float Threshold) const;
    //   ├─ float Threshold：输入参数，纯函数可以使用但不修改参数
    //   └─ bool：返回布尔值告诉调用者结果

    // 纯函数常见的"获取器"模式
    UFUNCTION(BlueprintPure, Category = "MyActor|Stats")
    float GetCurrentHealth() const { return Health; }
    //  └─ 简单的getter函数，完全适合用BlueprintPure

    UFUNCTION(BlueprintPure, Category = "MyActor|Stats")
    float GetMaxHealth() const { return MaxHealth; }

    UFUNCTION(BlueprintPure, Category = "MyActor|Stats")
    FVector GetAimDirection() const;  // 返回一个向量

private:
    float Health = 100.0f;
    float MaxHealth = 100.0f;
};
```

```cpp
// .cpp 实现文件
float AMyActor::GetHealthPercent() const
{
    // 防御：防止除以零
    if (MaxHealth <= 0.0f)
    {
        return 0.0f;  // 安全默认值
    }

    return Health / MaxHealth;  // 纯计算，不修改任何东西
}

bool AMyActor::IsHealthBelowThreshold(float Threshold) const
{
    // 简单的比较计算，符合纯函数的要求
    return Health < Threshold;
}

FVector AMyActor::GetAimDirection() const
{
    // 计算并返回瞄准方向，不修改任何状态
    FVector AimDir = GetActorForwardVector();
    return AimDir;
}
```

### 2.2 BlueprintPure 在蓝图中的表现

在蓝图事件图表中，BlueprintPure 函数表现为**只有数据引脚的绿色节点**：

```
GetHealthPercent [绿色节点]
   ├─ Return Value [输出数据引脚] → 连接到其他节点的数据引脚
   └─ （没有执行引脚！）
```

用法示例：

- 可以把 `GetHealthPercent` 的输出连接到 `<=`（小于等于比较）节点的输入
- 可以把 `GetHealthPercent` 的输出连接到 `Branch`（分支）节点的条件输入
- 因为纯函数没有执行引脚，它会在有数据需求时**自动计算**

> **⚠️ 重要提醒**：纯函数在每次被访问时都会重新执行计算。如果你的纯函数计算量大（如遍历大量数据），考虑改用 BlueprintCallable 并缓存结果。

---

## 3. BlueprintCallable vs BlueprintPure：核心区别

| 对比维度     | BlueprintCallable            | BlueprintPure                           |
| ------------ | ---------------------------- | --------------------------------------- |
| 蓝图节点颜色 | 蓝色（标准节点）             | 绿色（纯函数节点）                      |
| 执行引脚     | 有（输入+输出）              | 无                                      |
| 能否修改状态 | ✅ 可以                      | ❌ 不可以                               |
| const修饰符  | 不强制                       | ✅ 强烈建议（否则编译器不会阻止你犯错） |
| 典型用途     | 执行动作（开火、受伤、移动） | 查询状态（获取血量百分比、是否存活）    |
| 调用时机     | 执行流到达时执行一次         | 每次引用的引脚需要数据时计算            |

### 3.1 错误示范对比

```cpp
// ❌ 错误：把有副作用的函数声明为 BlueprintPure
UFUNCTION(BlueprintPure, Category = "Combat")
void FireWeapon();  // 开火有副作用（消耗子弹、播放特效），不应该是纯函数
//  ~~~~                                                      更不应该用BlueprintPure

// ✅ 正确：开火应该是 BlueprintCallable
UFUNCTION(BlueprintCallable, Category = "Combat")
void FireWeapon();  // 有副作用的动作，用BlueprintCallable

// ❌ 错误：BlueprintPure不写const
UFUNCTION(BlueprintPure, Category = "Stats")
float GetHealthPercent();  // 没有const，可能在未来被误改成会修改状态
//                           编译器不会阻止你在这个函数里修改成员变量

// ✅ 正确：BlueprintPure必须加const
UFUNCTION(BlueprintPure, Category = "Stats")
float GetHealthPercent() const;  // const保证这个函数不会修改成员变量
```

---

## 4. 函数参数传递：值传递 vs 引用传递在蓝图中的表现

### 4.1 值传递（Pass by Value）

```cpp
// 【值传递】蓝图调用时，传入的值被复制一份给函数
UFUNCTION(BlueprintCallable, Category = "Combat")
void TakeDamage(float DamageAmount, FName DamageType);
//              ├─ float DamageAmount：值传递，蓝图中显示为输入引脚
//              └─ FName DamageType：值传递，蓝图中显示为输入引脚

// 调用示例
void AMyActor::TakeDamage(float DamageAmount, FName DamageType)
{
    // DamageAmount是外部传入值的副本
    // 在这个函数里修改DamageAmount不会影响外部的原始值
    DamageAmount *= 2.0f;  // 这个修改只在函数内部有效

    Health -= DamageAmount;  // 实际扣除的是翻倍后的值
}
```

### 4.2 引用传递（Pass by Reference）

引用传递在蓝图中有特殊表现。**带 `&` 的引用参数在蓝图中表现为输出引脚。**

```cpp
// 【引用传递】蓝图中显示为输出引脚
UFUNCTION(BlueprintCallable, Category = "Combat")
void CalculateDamage(float& OutDamage, FVector& OutHitDirection);
//                   ├─ float& OutDamage：引用传递 → 蓝图中的"输出引脚"
//                   └─ FVector& OutHitDirection：引用传递 → 蓝图中的"输出引脚"

// 实现
void AMyActor::CalculateDamage(float& OutDamage, FVector& OutHitDirection)
{
    // 通过引用修改外部传入的变量
    OutDamage = BaseAttack * 2.5f;
    OutHitDirection = GetActorForwardVector();
    // 函数结束后，调用者传入的变量已经被修改
}
```

**蓝图中的表现：**

```
[执行输入] → CalculateDamage → [执行输出]
               OutDamage [输出引脚] ← 数据从这里流出来
               OutHitDirection [输出引脚] ← 数据从这里流出来
```

### 4.3 混合：既有输入又有输出

```cpp
UFUNCTION(BlueprintCallable, Category = "Combat")
void ProcessDamage(float RawDamage, bool& bOutCriticalHit, float& OutFinalDamage);
//                ├─ float RawDamage：值 = 输入引脚
//                ├─ bool& bOutCriticalHit：引用 = 输出引脚
//                └─ float& OutFinalDamage：引用 = 输出引脚

void AMyActor::ProcessDamage(float RawDamage, bool& bOutCriticalHit, float& OutFinalDamage)
{
    // 使用输入参数计算
    float CritChance = FMath::RandRange(0.0f, 1.0f);
    bOutCriticalHit = (CritChance > 0.7f);  // 设置输出参数
    OutFinalDamage = bOutCriticalHit ? RawDamage * 2.0f : RawDamage;  // 设置输出参数
}
```

**蓝图中：**

- `RawDamage`：输入引脚（需要连接数据）
- `bOutCriticalHit`：输出引脚（向外提供数据）
- `OutFinalDamage`：输出引脚（向外提供数据）

### 4.4 const 引用：输入但性能更好

```cpp
// 对于大型结构体（如FString、自定义USTRUCT），使用const引用避免复制
UFUNCTION(BlueprintCallable, Category = "Combat")
void ApplyDamageWithInfo(const FDamageInfo& DamageInfo);  // const引用 = 输入引脚
//                        ├─ const：不修改传入的数据
//                        └─ &：传递引用而不是复制，提高性能
```

### 4.5 名称约定

UE社区遵循以下命名约定，强烈建议遵守：

| 参数角色 | 命名前缀      | 示例                         |
| -------- | ------------- | ---------------------------- |
| 输入参数 | 无前缀或 `In` | `DamageAmount` 或 `InDamage` |
| 输出参数 | `Out`         | `OutDamage`, `OutHitResult`  |
| 布尔值   | `b`           | `bSuccess`, `bIsAlive`       |

---

## 5. 返回值类型在蓝图中的映射

### 5.1 UE支持的所有蓝图返回类型

C++中几乎所有基本类型和UE类型都可以作为返回值：

```cpp
// ===== 基本类型 =====
UFUNCTION(BlueprintCallable, Category = "Types")
int32 GetKillCount() const;
// 蓝图类型：Integer（整数）

UFUNCTION(BlueprintCallable, Category = "Types")
float GetSpeed() const;
// 蓝图类型：Float（浮点数）

UFUNCTION(BlueprintCallable, Category = "Types")
bool IsAlive() const;
// 蓝图类型：Boolean（布尔值）

UFUNCTION(BlueprintCallable, Category = "Types")
FString GetPlayerName() const;
// 蓝图类型：String（字符串）

UFUNCTION(BlueprintCallable, Category = "Types")
FName GetItemName() const;
// 蓝图类型：Name（名称，比String更轻量）

UFUNCTION(BlueprintCallable, Category = "Types")
FText GetDisplayName() const;
// 蓝图类型：Text（本地化文本）

// ===== UE数学类型 =====
UFUNCTION(BlueprintCallable, Category = "Types")
FVector GetSpawnLocation() const;
// 蓝图类型：Vector（三维向量）

UFUNCTION(BlueprintCallable, Category = "Types")
FRotator GetAimRotation() const;
// 蓝图类型：Rotator（旋转角度）

UFUNCTION(BlueprintCallable, Category = "Types")
FTransform GetSocketTransform() const;
// 蓝图类型：Transform（位置+旋转+缩放组合）

// ===== UE对象类型 =====
UFUNCTION(BlueprintCallable, Category = "Types")
AActor* GetCurrentTarget() const;
// 蓝图类型：Actor对象引用

UFUNCTION(BlueprintCallable, Category = "Types")
UStaticMeshComponent* GetBodyMesh() const;
// 蓝图类型：StaticMeshComponent对象引用

// ===== 自定义USTRUCT =====
UFUNCTION(BlueprintCallable, Category = "Types")
FDamageInfo CalculateDamageInfo() const;
// 蓝图类型：对应你的自定义结构体类型（需要结构体有BlueprintType标记）

// ===== 自定义UENUM =====
UFUNCTION(BlueprintCallable, Category = "Types")
EWeaponType GetCurrentWeaponType() const;
// 蓝图类型：对应你的自定义枚举类型（需要枚举有BlueprintType标记）

// ===== TArray（数组）=====
UFUNCTION(BlueprintCallable, Category = "Types")
TArray<AActor*> GetAllEnemiesInRange() const;
// 蓝图类型：Actor数组
```

### 5.2 多返回值：使用引用参数代替

C++不支持多个返回值，但UE通过引用参数实现了类似效果：

```cpp
// ❌ 错误：C++不支持多个返回值
UFUNCTION(BlueprintCallable, Category = "Combat")
float, bool, FVector CalculateDamage();  // 语法错误！C++不能这样写

// ✅ 方案1：使用引用输出参数（推荐，适用于2-3个输出）
UFUNCTION(BlueprintCallable, Category = "Combat")
void CalculateDamage(float& OutDamage, bool& OutIsCritical, FVector& OutHitLocation);
// 蓝图中会显示三个输出引脚：OutDamage, OutIsCritical, OutHitLocation

// ✅ 方案2：使用结构体封装多个返回值（适用于4个以上输出）
USTRUCT(BlueprintType)
struct FDamageResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    float Damage = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    bool bIsCritical = false;

    UPROPERTY(BlueprintReadOnly)
    FVector HitLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly)
    AActor* DamageCauser = nullptr;
};

UFUNCTION(BlueprintCallable, Category = "Combat")
FDamageResult CalculateDamageWithResult() const;
// 蓝图中返回一个结构体，包含所有字段
```

### 5.3 返回指针 vs 返回引用

```cpp
// 返回指针（可能为nullptr）
UFUNCTION(BlueprintCallable, Category = "Targeting")
AActor* GetClosestEnemy() const;
// 蓝图可以检查返回值是否为None

// 返回const引用（不复制，只读取）
UFUNCTION(BlueprintPure, Category = "Stats")
const FDamageInfo& GetLastDamageInfo() const;

// 注意：不要返回局部变量的引用或指针！
// ❌ 严重错误：
UFUNCTION(BlueprintPure)
const FVector& GetCalculatedPosition() const
{
    FVector Result = SomeCalculation();  // Result是局部变量
    return Result;  // ❌ 函数结束时Result被销毁，返回悬空引用！崩溃！
}
```

---

## 6. Category 的组织规范

### 6.1 为什么需要规范 Category？

Category 不只是让函数在蓝图右键菜单里好看——它是代码组织的重要方式。一个团队项目可能有几百个 BlueprintCallable 函数，没有规范的 Category 分类会让蓝图调用者难以找到需要的函数。

### 6.2 推荐的 Category 命名规范

```cpp
// ===== 规范格式："类名|子系统|子功能" =====

// ✅ 好的Category组织
UCLASS()
class MYPROJECT_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ----- 战斗系统 -----
    UFUNCTION(BlueprintCallable, Category = "Character|Combat")
    void TakeDamage(float Amount);

    UFUNCTION(BlueprintCallable, Category = "Character|Combat")
    void Heal(float Amount);

    UFUNCTION(BlueprintPure, Category = "Character|Combat")
    float GetHealthPercent() const;

    UFUNCTION(BlueprintPure, Category = "Character|Combat")
    bool IsAlive() const;

    // ----- 移动系统 -----
    UFUNCTION(BlueprintCallable, Category = "Character|Movement")
    void Sprint(bool bEnable);

    UFUNCTION(BlueprintCallable, Category = "Character|Movement")
    void Dodge(FVector Direction);

    UFUNCTION(BlueprintPure, Category = "Character|Movement")
    float GetCurrentSpeed() const;

    // ----- 能力系统 -----
    UFUNCTION(BlueprintCallable, Category = "Character|Abilities")
    void ActivateAbility(FName AbilityName);

    UFUNCTION(BlueprintCallable, Category = "Character|Abilities")
    void CancelAllAbilities();

    UFUNCTION(BlueprintPure, Category = "Character|Abilities")
    bool IsAbilityReady(FName AbilityName) const;

    // ----- 事件回调（用Events分类）-----
    UFUNCTION(BlueprintImplementableEvent, Category = "Character|Events")
    void OnHealthChanged(float NewHealth, float OldHealth);

    UFUNCTION(BlueprintImplementableEvent, Category = "Character|Events")
    void OnDeath();

    // ----- 调试专用 -----
    UFUNCTION(CallInEditor, Category = "Character|Debug")
    void DebugResetHealth();

    UFUNCTION(CallInEditor, Category = "Character|Debug")
    void DebugKillCharacter();
};
```

在蓝图右键菜单中，这会显示为：

```
Character
  ├─ Combat
  │   ├─ TakeDamage
  │   ├─ Heal
  │   ├─ GetHealthPercent
  │   └─ IsAlive
  ├─ Movement
  │   ├─ Sprint
  │   ├─ Dodge
  │   └─ GetCurrentSpeed
  ├─ Abilities
  │   ├─ ActivateAbility
  │   ├─ CancelAllAbilities
  │   └─ IsAbilityReady
  ├─ Events
  │   ├─ OnHealthChanged
  │   └─ OnDeath
  └─ Debug
      ├─ DebugResetHealth
      └─ DebugKillCharacter
```

### 6.3 Category 的反模式

```cpp
// ❌ 不写Category —— 函数散落在"默认"分类下，很难找
UFUNCTION(BlueprintCallable)
void TakeDamage(float Amount);

// ❌ Category太宽泛 —— 和其他类的函数混在一起
UFUNCTION(BlueprintCallable, Category = "Combat")
void TakeDamage(float Amount);

// ❌ Category名和函数名一样 —— 没有组织效果
UFUNCTION(BlueprintCallable, Category = "TakeDamage")
void TakeDamage(float Amount);

// ❌ Category拼写不一致
UFUNCTION(BlueprintCallable, Category = "Character|Combat")
void TakeDamage(float Amount);
UFUNCTION(BlueprintCallable, Category = "Character|combat")  // 大小写不一致！
void Heal(float Amount);
```

---

## 7. 高级参数：meta 标签详解

### 7.1 meta 概述

`meta` 是 UFUNCTION 的可选参数，用于向编辑器和蓝图传递**额外的元数据**。它放在函数说明符的括号内，格式为 `meta = (Key = "Value", ...)`。

### 7.2 常用 meta 标签完整列表

```cpp
UCLASS()
class MYPROJECT_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ===== 7.2.1 WorldContext —— 获取世界上下文 =====
    // 用途：在静态函数或非Actor类中，让引擎知道从哪里获取World对象
    // 这在使用蓝图异步节点（如Delay、Latent Action）时必不可少

    // 静态函数示例
    UFUNCTION(BlueprintCallable, Category = "Utilities",
              meta = (WorldContext = "WorldContextObject"))
    //               ──────────────┬──────────────
    // 告诉引擎：这个参数就是"世界上下文"，从它获取World
    static void PrintWorldInfo(const UObject* WorldContextObject);
    //                         ───────┬──────
    // 这个参数在蓝图中会自动隐藏，不需要手动连接！
};

// 在.cpp中实现
void AMyCharacter::PrintWorldInfo(const UObject* WorldContextObject)
{
    // 从WorldContextObject获取World
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject,
                                                        EGetWorldErrorMode::LogAndReturnNull);
    if (World)
    {
        UE_LOG(LogTemp, Log, TEXT("当前世界名称: %s"), *World->GetName());
    }
}

// ===== 7.2.2 WorldContext在BlueprintAsyncActionBase中的经典用法 =====
// 在自定义异步任务节点中，WorldContext是必需的：
UFUNCTION(BlueprintCallable, Category = "Async",
          meta = (WorldContext = "WorldContextObject",
                  BlueprintInternalUseOnly = "true"))
//                ─────────────┬────────────
// BlueprintInternalUseOnly=true：这个函数不会出现在蓝图右键菜单中
// 只用于内部实现，通常配合异步任务节点使用
static UMyAsyncTask* CreateMyAsyncTask(const UObject* WorldContextObject);

// ===== 7.2.3 DisplayName —— 自定义蓝图中的显示名称 =====
UFUNCTION(BlueprintCallable, Category = "Combat",
          meta = (DisplayName = "受到伤害"))
//                ────────┬────────
// 蓝图中显示"受到伤害"而不是"TakeDamage"
void TakeDamage(float Amount);

// ===== 7.2.4 Keywords —— 为蓝图搜索添加关键词 =====
UFUNCTION(BlueprintCallable, Category = "Combat",
          meta = (Keywords = "Damage Hit Hurt Injure Wound"))
//                ──────────┬──────────
// 在蓝图中搜索这些英文关键词也能找到这个函数
void TakeDamage(float Amount);

// ===== 7.2.5 AdvancedDisplay —— 将参数放入"高级"折叠区 =====
UFUNCTION(BlueprintCallable, Category = "Combat",
          meta = (AdvancedDisplay = "2"))
//                ──────────┬────
// 从第2个参数开始放入"Advanced"折叠区（索引从0开始）
void TakeDamage(float Amount, FName DamageType, AActor* Instigator, FVector HitLocation);
//               └── 0 ──┘ └────── 1 ──────┘ └───── 2 ───────┘ └─────── 3 ───────┘
//                                     ↑ 从这里开始被折叠（索引2及以后）

// 也可以指定多个参数名
UFUNCTION(BlueprintCallable, Category = "Combat",
          meta = (AdvancedDisplay = "DamageType, Instigator, HitLocation"))
//                ─────────────────────┬────────────────────
// 通过参数名指定哪些参数放入高级折叠区
void TakeDamage(float Amount, FName DamageType, AActor* Instigator, FVector HitLocation);

// ===== 7.2.6 CompactNodeTitle —— 紧凑节点标题 =====
UFUNCTION(BlueprintPure, Category = "Combat",
          meta = (CompactNodeTitle = "HP%"))
//                ───────────┬───────────
// 蓝图节点上显示简短标题"HP%"，而不是完整函数名"GetHealthPercent"
float GetHealthPercent() const;

// ===== 7.2.7 CallInEditor —— 编辑器中可调用 =====
// 虽然CallInEditor本身是说明符，但经常和meta配合使用
UFUNCTION(CallInEditor, Category = "Debug",
          meta = (DisplayName = "Debug: 重置血量"))
void DebugResetHealth();

// ===== 7.2.8 DetermineOutputType —— 根据输入决定输出类型 =====
// 用于模板化返回类型：输出类型由输入参数的类型决定
UFUNCTION(BlueprintCallable, Category = "Utilities",
          meta = (DeterminesOutputType = "ActorClass"))
//                ───────────┬──────────
// 返回值AActor*的具体类型由ActorClass参数决定
AActor* SpawnActorOfClass(TSubclassOf<AActor> ActorClass, FVector Location);

// ===== 7.2.9 HidePin —— 隐藏指定引脚 =====
UFUNCTION(BlueprintCallable, Category = "Utilities",
          meta = (HidePin = "WorldContextObject", DefaultToSelf = "WorldContextObject"))
//                ─────┬─────              ───────┬───────
// HidePin：在蓝图中隐藏这个引脚
// DefaultToSelf：如果没有连接，默认使用self（当前Actor）
static void MyUtilityFunction(const UObject* WorldContextObject, float Value);

// ===== 7.2.10 Latent —— 延迟动作节点 =====
UFUNCTION(BlueprintCallable, Category = "Utilities",
          meta = (Latent, LatentInfo = "LatentInfo",
                  WorldContext = "WorldContextObject"))
//                ──┬──  ──────────┬────────
// Latent：这是一个"延迟动作"节点，执行后会有后续回调
// LatentInfo：指定哪个参数是延迟信息参数（用于管理延迟执行的内部状态）
void MyDelayedAction(const UObject* WorldContextObject,
                     struct FLatentActionInfo LatentInfo,
                     float DelayTime);

// ===== 7.2.11 ExpandEnumAsExecs —— 展开枚举为多个执行引脚 =====
// 把枚举返回值展开为多个执行输出引脚，每个枚举值一个
UFUNCTION(BlueprintCallable, Category = "Combat",
          meta = (ExpandEnumAsExecs = "OutBranch"))
//                ────────┬────────
// 枚举参数OutBranch的每个值变成一个执行输出引脚
void BranchOnDamageType(FName DamageType,
                        TEnumAsByte<EDamageType>& OutBranch);
```

### 7.3 meta 标签实战组合示例

```cpp
// 一个综合了多种meta标签的"终极"函数声明
UFUNCTION(BlueprintCallable, Category = "MyGame|Combat",
          meta = (DisplayName = "对目标造成伤害",
                  Keywords = "Damage Hit Attack",
                  AdvancedDisplay = "DamageType, InstigatorOverride",
                  AutoCreateRefTerm = "DamageType"))
//                ──────────┬─────────
// AutoCreateRefTerm：如果这个参数是const引用类型，
// 蓝图中会自动创建一个默认值的临时变量，用户不需要手动连接
void DealDamageToTarget(AActor* Target,
                        float DamageAmount,
                        const FName& DamageType = NAME_None,   // 默认参数，会被自动创建
                        AActor* InstigatorOverride = nullptr);  // 默认参数
```

---

## 8. 常用蓝图节点的C++实现示例

### 8.1 获取玩家控制器

```cpp
UFUNCTION(BlueprintCallable, Category = "Utilities|Player",
          meta = (WorldContext = "WorldContextObject"))
static APlayerController* GetLocalPlayerController(const UObject* WorldContextObject);
```

```cpp
APlayerController* AMyCharacter::GetLocalPlayerController(const UObject* WorldContextObject)
{
    // 从上下文对象获取World
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject,
                                                        EGetWorldErrorMode::LogAndReturnNull);
    if (!World)
    {
        return nullptr;  // 没有有效的World，返回空
    }

    // 获取第一个本地玩家控制器
    return World->GetFirstPlayerController();
}
```

### 8.2 在指定位置生成Actor

```cpp
// .h声明
UFUNCTION(BlueprintCallable, Category = "Utilities|Spawning",
          meta = (DeterminesOutputType = "ActorClass",
                  WorldContext = "WorldContextObject"))
static AActor* SpawnActorAtLocation(const UObject* WorldContextObject,
                                    TSubclassOf<AActor> ActorClass,
                                    FVector Location,
                                    FRotator Rotation = FRotator::ZeroRotator);
```

```cpp
// .cpp实现
AActor* AMyCharacter::SpawnActorAtLocation(const UObject* WorldContextObject,
                                            TSubclassOf<AActor> ActorClass,
                                            FVector Location,
                                            FRotator Rotation)
{
    // 参数验证
    if (!ActorClass)
    {
        UE_LOG(LogTemp, Warning, TEXT("SpawnActorAtLocation: ActorClass为空"));
        return nullptr;
    }

    // 获取World
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject,
                                                        EGetWorldErrorMode::LogAndReturnNull);
    if (!World)
    {
        return nullptr;
    }

    // 设置生成参数
    FActorSpawnParameters SpawnParams;
    SpawnParams.SpawnCollisionHandlingOverride =
        ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    //  └─ 生成时如果位置有碰撞，尝试调整位置，但无论如何都会生成

    // 生成Actor
    AActor* SpawnedActor = World->SpawnActor<AActor>(ActorClass, Location, Rotation, SpawnParams);

    return SpawnedActor;
}
```

### 8.3 查找范围内的所有敌人

```cpp
// .h声明
UFUNCTION(BlueprintCallable, Category = "Combat|Targeting",
          meta = (DisplayName = "查找半径内所有敌人"))
void FindEnemiesInRadius(float Radius, TArray<AActor*>& OutEnemies) const;
```

```cpp
// .cpp实现
void AMyCharacter::FindEnemiesInRadius(float Radius, TArray<AActor*>& OutEnemies) const
{
    // 清空输出数组（防御性编程）
    OutEnemies.Empty();

    // 获取当前Actor的位置作为搜索中心
    FVector SearchOrigin = GetActorLocation();

    // 获取世界对象
    UWorld* World = GetWorld();
    if (!World)
    {
        return;  // 没有有效世界，直接返回
    }

    // 设置碰撞查询参数
    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(this);  // 忽略自己

    // 使用球体重叠检测查找范围内的所有Actor
    TArray<FOverlapResult> OverlapResults;
    bool bHit = World->OverlapMultiByChannel(
        OverlapResults,           // 输出：重叠结果数组
        SearchOrigin,             // 搜索中心点
        FQuat::Identity,          // 球体不需要旋转
        ECC_Pawn,                 // 碰撞通道：检测Pawn类型
        FCollisionShape::MakeSphere(Radius),  // 球体形状，半径为参数值
        QueryParams               // 查询参数（忽略自己等）
    );

    if (!bHit)
    {
        return;  // 没有检测到任何Actor
    }

    // 遍历所有重叠结果
    for (const FOverlapResult& Result : OverlapResults)
    {
        AActor* HitActor = Result.GetActor();
        if (HitActor)
        {
            OutEnemies.Add(HitActor);  // 添加到输出数组
        }
    }

    UE_LOG(LogTemp, Log, TEXT("在半径%.0f内找到%d个Actor"), Radius, OutEnemies.Num());
}
```

### 8.4 蓝图中的"Delay"——延迟执行

```cpp
// .h声明
UFUNCTION(BlueprintCallable, Category = "Utilities|Flow",
          meta = (Latent, LatentInfo = "LatentInfo",
                  WorldContext = "WorldContextObject",
                  DisplayName = "自定义延迟"))
static void CustomDelay(const UObject* WorldContextObject,
                        struct FLatentActionInfo LatentInfo,
                        float Duration);
```

```cpp
// .cpp实现
void AMyCharacter::CustomDelay(const UObject* WorldContextObject,
                                struct FLatentActionInfo LatentInfo,
                                float Duration)
{
    // 获取World
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject,
                                                        EGetWorldErrorMode::LogAndReturnNull);
    if (!World)
    {
        return;
    }

    // 获取LatentAction管理器
    FLatentActionManager& LatentActionManager = World->GetLatentActionManager();
    //  └─ LatentActionManager负责管理所有"等待类"操作

    // 检查是否已存在同名LatentAction（避免重复创建）
    if (LatentActionManager.FindExistingAction<FDelayAction>(
            LatentInfo.CallbackTarget, LatentInfo.UUID) == nullptr)
    {
        // 添加一个新的延迟动作：Duration秒后恢复执行
        LatentActionManager.AddNewAction(
            LatentInfo.CallbackTarget,  // 回调目标
            LatentInfo.UUID,            // 唯一标识符
            new FDelayAction(Duration, LatentInfo)  // 延迟动作对象
        );
    }
}
```

在蓝图中，这个函数表现为一个**异步节点**：

```
[立即执行输出]
        ↓
CustomDelay [节点]
  ├─ Duration [输入：延迟秒数]
  ├─ [延迟执行输出] ← Duration秒后从这里继续执行
  └─ ...
```

### 8.5 将蓝图函数封装为静态工具函数库

有时你需要一个纯工具函数，不属于任何特定Actor。这时创建一个`BlueprintFunctionLibrary`子类：

```cpp
// MyBlueprintFunctionLibrary.h
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "MyBlueprintFunctionLibrary.generated.h"

// UBlueprintFunctionLibrary 是专门用于存放静态蓝图可调用函数的基类
UCLASS()
class MYPROJECT_API UMyBlueprintFunctionLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    // 注意：BlueprintFunctionLibrary中的函数必须是static的
    // 因为这种类不会被实例化为对象

    // ===== 数学工具 =====
    UFUNCTION(BlueprintPure, Category = "MyLibrary|Math")
    static float ClampAngle(float AngleDegrees, float Min, float Max);

    // ===== 字符串工具 =====
    UFUNCTION(BlueprintPure, Category = "MyLibrary|String")
    static FString ReverseString(const FString& Input);

    // ===== 世界相关 =====
    UFUNCTION(BlueprintCallable, Category = "MyLibrary|World",
              meta = (WorldContext = "WorldContextObject"))
    static void PrintToAllClients(const UObject* WorldContextObject, const FString& Message);
};
```

```cpp
// MyBlueprintFunctionLibrary.cpp
#include "MyBlueprintFunctionLibrary.h"

float UMyBlueprintFunctionLibrary::ClampAngle(float AngleDegrees, float Min, float Max)
{
    // 将角度归一化到[-180, 180]范围，然后限制在[Min, Max]
    float Normalized = FMath::Fmod(AngleDegrees + 180.0f, 360.0f);
    if (Normalized < 0.0f) Normalized += 360.0f;
    Normalized -= 180.0f;
    return FMath::Clamp(Normalized, Min, Max);
}

FString UMyBlueprintFunctionLibrary::ReverseString(const FString& Input)
{
    FString Reversed;
    // 从后向前遍历字符串
    for (int32 i = Input.Len() - 1; i >= 0; --i)
    {
        Reversed.AppendChar(Input[i]);  // 逐个字符添加到结果
    }
    return Reversed;
}

void UMyBlueprintFunctionLibrary::PrintToAllClients(const UObject* WorldContextObject,
                                                     const FString& Message)
{
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject,
                                                        EGetWorldErrorMode::LogAndReturnNull);
    if (World)
    {
        // 使用AddOnScreenDebugMessage在所有客户端屏幕上显示消息
        // -1表示使用默认颜色
        // 5.0f表示显示5秒
        GEngine->AddOnScreenDebugMessage(-1, 5.0f, FColor::Green, Message);
    }
}
```

---

## 9. 易错点与最佳实践总结

### 9.1 常见编译错误

```cpp
// ❌ 错误1：BlueprintPure没有const修饰
UFUNCTION(BlueprintPure, Category = "Stats")
float GetHealthPercent();  // 编译警告：BlueprintPure函数建议用const修饰

// ✅ 正确：
UFUNCTION(BlueprintPure, Category = "Stats")
float GetHealthPercent() const;

// ❌ 错误2：在const函数中修改成员变量
UFUNCTION(BlueprintPure, Category = "Stats")
float GetHealthPercent() const
{
    Health += 10.0f;  // ❌ 编译错误：const成员函数不能修改成员变量
    return Health / MaxHealth;
}

// ❌ 错误3：静态BlueprintFunctionLibrary函数不是static
UCLASS()
class UMyLib : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
    UFUNCTION(BlueprintCallable)
    void DoSomething();  // ❌ 必须是static!
};

// ✅ 正确：
UFUNCTION(BlueprintCallable)
static void DoSomething();

// ❌ 错误4：meta参数语法错误
UFUNCTION(BlueprintCallable, meta(DisplayName = "测试"))  // ❌ 缺少等号
void Test();

// ✅ 正确：
UFUNCTION(BlueprintCallable, meta = (DisplayName = "测试"))
void Test();
```

### 9.2 最佳实践速查

| 场景           | 推荐做法                        | 不推荐                            |
| -------------- | ------------------------------- | --------------------------------- |
| 纯查询/计算    | `BlueprintPure` + `const`       | `BlueprintCallable`               |
| 有副作用的动作 | `BlueprintCallable`             | `BlueprintPure`                   |
| 大型结构体参数 | `const &`（const引用）          | 值传递                            |
| 输出参数       | `&`引用 + `Out`前缀             | 值传递做输出                      |
| 函数分类       | `"类名\|子系统"` 格式           | 无Category或太宽泛                |
| 蓝图显示名     | `meta = (DisplayName = "...")`  | 直接改函数名（C++命名规范更重要） |
| 静态工具函数   | `UBlueprintFunctionLibrary`子类 | 放在Actor中做静态函数             |

---

## 完成检查清单

- [ ] 能在C++中正确声明 BlueprintCallable 函数，并在蓝图中成功调用
- [ ] 理解 BlueprintCallable（有执行引脚，可修改状态）和 BlueprintPure（无执行引脚，不可修改状态）的核心区别
- [ ] BlueprintPure 函数都已添加 const 修饰符
- [ ] 理解值传递=输入引脚，引用传递=输出引脚的蓝图映射规则
- [ ] 使用 `Out` 前缀命名所有输出参数
- [ ] Category 使用 `"类名|子系统"` 格式，团队风格统一
- [ ] 了解 WorldContext、DisplayName、AdvancedDisplay、Keywords 等 meta 标签的用法
- [ ] 知道如何创建 BlueprintFunctionLibrary 存放工具函数
- [ ] 没有在 const 函数中修改成员变量
- [ ] 没有把有副作用的函数声明为 BlueprintPure
