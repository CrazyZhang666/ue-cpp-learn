# 3.2 UCLASS / USTRUCT / UENUM 详解

> **目标**：全面掌握UE中标记类、结构体、枚举的宏，理解每个参数的作用。

---

## UCLASS — 让类被UE系统"看见"

### 基本形式

```cpp
UCLASS(参数1, 参数2, ...)  // 多个参数用逗号分隔
class MYMODULE_API UMyClass : public UObject
{
    GENERATED_BODY()
    // ...
};
```

### UCLASS参数速查表

#### 蓝图相关

| 参数 | 效果 |
|------|------|
| `Blueprintable` | 可以在蓝图中被继承（创建蓝图子类） |
| `NotBlueprintable` | 禁止蓝图继承（默认很多人是Blueprintable，看父类设置） |
| `BlueprintType` | 可以作为蓝图变量类型 |

```cpp
// 示例：创建一个可被蓝图继承的类
UCLASS(Blueprintable)
class MYGAME_API UMyGameplayObject : public UObject
{
    GENERATED_BODY()
    // 蓝图中可以创建这个类的子类
};

// 示例：一个纯C++类，蓝图不可见
UCLASS(NotBlueprintable)
class MYGAME_API UInternalHelper : public UObject
{
    GENERATED_BODY()
    // 这个类蓝图看不到，只有C++能用
};
```

#### 编辑器相关

| 参数 | 效果 |
|------|------|
| `HideCategories("分类1","分类2")` | 在编辑器细节面板隐藏指定分类的属性 |
| `ShowCategories("分类1")` | 显示指定分类 |
| `ClassGroup("组名")` | 在添加类对话框中归到哪个组 |
| `HideDropdown` | 不在类选择下拉框中出现 |
| `Deprecated` | 标记为已弃用 |

```cpp
UCLASS(Blueprintable, HideCategories = (Physics, Collision))
//                       ──────────────────────────────
//                       在编辑器中，Physics和Collision分类的属性都会被隐藏
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()
    // ...
};
```

#### 抽象与配置

| 参数 | 效果 |
|------|------|
| `Abstract` | 抽象类，不能直接放入场景 |
| `Config=Game` | 这个类的属性可以保存到Game.ini配置文件 |
| `DefaultToInstanced` | 子对象默认创建实例（用于Component） |
| `Within="OuterClassName"` | 限制这个类只能作为指定类的子对象 |

```cpp
// 抽象类：只能被继承，不能直接实例化
UCLASS(Abstract, Blueprintable)
class MYGAME_API ABaseEnemy : public AActor
{
    GENERATED_BODY()
    // 不能直接把ABaseEnemy拖入场景
    // 必须创建它的子类（如AOrcEnemy, ADragonEnemy）
};

// 配置类：属性保存到ini文件
UCLASS(Config=Game)
class MYGAME_API UMyGameSettings : public UObject
{
    GENERATED_BODY()

    UPROPERTY(Config)  // 这个属性的值保存到Game.ini
    float MasterVolume = 1.0f;
};
```

---

## USTRUCT — 纯数据结构也能享受UE魔力

### 基本形式

```cpp
USTRUCT(BlueprintType)  // BlueprintType = 可以作为蓝图变量类型
struct MYMODULE_API FMyStruct
{
    GENERATED_BODY()  // 结构体也需要这个！

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Value;
};
```

### USTRUCT vs UCLASS 的关键区别

| 特性 | UCLASS | USTRUCT |
|------|--------|---------|
| 垃圾回收 | ✅ 自动GC | ❌ 不被GC管理（值类型） |
| 继承 | ✅ 支持 | ❌ 不支持继承（只能单层） |
| 蓝图变量 | ✅ | ✅（需BlueprintType） |
| new创建 | ❌（用NewObject） | ✅（可以new） |
| 栈上分配 | ❌ | ✅ |
| 复制传递 | 引用（指针） | 值拷贝 |
| 适用场景 | 复杂对象、组件 | 简单数据聚合 |

```cpp
// 结构体：适合做"数据容器"
USTRUCT(BlueprintType)
struct FPlayerStats
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Health = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MaxHealth = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Level = 1;

    // 结构体可以有函数
    float GetHealthPercent() const
    {
        return (MaxHealth > 0.0f) ? Health / MaxHealth : 0.0f;
    }
};

// 使用
FPlayerStats Stats;  // 直接在栈上创建
Stats.Health = 75.0f;
float Percent = Stats.GetHealthPercent();  // 0.75 = 75%
```

### USTRUCT常用参数

| 参数 | 效果 |
|------|------|
| `BlueprintType` | 可以在蓝图中作为变量类型使用 |
| `NotBlueprintType` | 禁止蓝图使用 |
| `Atomic` | 原子结构体（确保完整拷贝） |
| `Immutable` | 不可变结构体 |

---

## UENUM — 让枚举在编辑器中更好看

### 基本形式

```cpp
// 普通枚举（UE之前）
enum class EMyEnum : uint8  // : uint8 = 指定底层类型为8位整数（省内存）
{
    Value1,  // = 0
    Value2,  // = 1
    Value3   // = 2
};

// UE增强版枚举
UENUM(BlueprintType)  // BlueprintType = 蓝图变量可用
enum class EWeaponType : uint8
{
    Melee     UMETA(DisplayName = "近战武器"),  // UMETA添加元数据
    Ranged    UMETA(DisplayName = "远程武器"),
    Magic     UMETA(DisplayName = "魔法武器"),
    Throwable UMETA(DisplayName = "投掷武器")
};

// 使用
EWeaponType Type = EWeaponType::Melee;
// 在蓝图和编辑器下拉框中显示为"近战武器"而不是"Melee"
```

### UENUM常用参数

| 参数 | 效果 |
|------|------|
| `BlueprintType` | 可作为蓝图变量类型 |
| `Flags` | 标记为位标志枚举（可组合） |

### UMETA常用参数

| 参数 | 效果 |
|------|------|
| `DisplayName = "名称"` | 编辑器中显示的中文名 |
| `Tooltip = "提示"` | 鼠标悬停时的提示文字 |
| `Hidden` | 不在下拉列表中显示这个选项 |

```cpp
// Flags枚举：可以组合多个值
UENUM(BlueprintType, Flags)
enum class ECharacterState : uint8
{
    None      = 0        UMETA(Hidden),  // 0表示无状态，且在下拉框中隐藏
    Idle      = 1 << 0   UMETA(DisplayName = "待机"),  // 1
    Moving    = 1 << 1   UMETA(DisplayName = "移动"),  // 2
    Jumping   = 1 << 2   UMETA(DisplayName = "跳跃"),  // 4
    Attacking = 1 << 3   UMETA(DisplayName = "攻击"),  // 8
    Stunned   = 1 << 4   UMETA(DisplayName = "眩晕"),  // 16
};
// 1 << 0 = 二进制 0000 0001 = 十进制 1
// 1 << 1 = 二进制 0000 0010 = 十进制 2
// 1 << 2 = 二进制 0000 0100 = 十进制 4
// ...
// 这样做的好处：可以用位运算组合状态

// 组合多个状态
uint8 Combined = static_cast<uint8>(ECharacterState::Moving)
               | static_cast<uint8>(ECharacterState::Attacking);
// | 是按位或操作符
// Moving(00000010) | Attacking(00001000) = 00001010 = 既在移动又在攻击

// 检查是否包含某个状态
bool bIsAttacking = (Combined & static_cast<uint8>(ECharacterState::Attacking)) != 0;
// & 是按位与操作符
```

---

## 实际应用示例：完整的类定义

```cpp
// WeaponItem.h
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "WeaponItem.generated.h"

// 1. 先定义枚举
UENUM(BlueprintType)
enum class EWeaponSlot : uint8
{
    Primary   UMETA(DisplayName = "主武器"),
    Secondary UMETA(DisplayName = "副武器"),
    Melee     UMETA(DisplayName = "近战"),
    Throwable UMETA(DisplayName = "投掷物")
};

// 2. 定义数据结构体
USTRUCT(BlueprintType)
struct FWeaponStats
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float BaseDamage = 10.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float FireRate = 1.0f;  // 每秒射击次数

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    int32 MagazineSize = 30;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stats")
    float ReloadTime = 2.0f;

    // 计算每秒伤害
    float GetDPS() const
    {
        return BaseDamage * FireRate;
    }
};

// 3. 定义UObject类
UCLASS(Blueprintable, BlueprintType)
class MYGAME_API UWeaponItem : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
    FString WeaponName = TEXT("未命名武器");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
    EWeaponSlot Slot = EWeaponSlot::Primary;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
    FWeaponStats Stats;

    UFUNCTION(BlueprintPure, Category = "Weapon")
    float GetDPS() const
    {
        return Stats.GetDPS();
    }
};
```

---

## 完成检查清单

- [ ] 知道UCLASS至少要加什么参数
- [ ] 理解USTRUCT和UCLASS的本质区别
- [ ] 会用UENUM和UMETA给枚举加中文显示名
- [ ] 理解Flags枚举的位运算用法
- [ ] 能独立写一个完整的UCLASS/USTRUCT/UENUM定义
