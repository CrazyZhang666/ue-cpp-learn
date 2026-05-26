# 13.2 AbilitySystemComponent (ASC)

> **目标**：理解GAS的大脑——AbilitySystemComponent的创建、配置、放置策略和核心API。

---

## ASC是什么——用类比理解

```
┌──────────────────────────────────────────────────────────────────┐
│                     ASC 类比理解                                   │
│                                                                   │
│  ASC之于GAS  ≈  控制器(Controller)之于MVC                         │
│  ASC之于GAS  ≈  大脑之于身体                                      │
│  ASC之于GAS  ≈  交通指挥中心之于道路交通                           │
│                                                                   │
│  ASC不直接"做"事情（不放技能、不算伤害）                            │
│  ASC负责"调度"和"协调"所有事情                                      │
│                                                                   │
│  ┌─────────────────────────────────────────────┐                 │
│  │  ASC = 技能系统的操作系统（类似Windows/Linux）│                 │
│  │                                             │                 │
│  │  操作系统不帮你写文档，但它管理：              │                 │
│  │  • 哪些程序在运行（GA管理）                   │                 │
│  │  • 程序间如何通信（标签/效果传递）             │                 │
│  │  • 资源分配（属性修改协调）                    │                 │
│  │  • 权限管理（网络同步）                       │                 │
│  └─────────────────────────────────────────────┘                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

`UAbilitySystemComponent` 继承自 `UActorComponent`，它是Actor上的一个组件。任何一个想要参与GAS系统的Actor（玩家角色、敌人、NPC等），都需要拥有一个ASC。

---

## ASC应该放在哪里——重要的架构决策

这是GAS学习中最关键、也最容易出错的架构决策之一。ASC放在哪里决定了你的项目架构是否合理、网络同步是否正确。

### 三种放置方案对比

```
╔══════════════════════════════════════════════════════════════════╗
║                ASC 放置位置对比                                   ║
╠════════┬─────────────────────┬─────────────────────┬─────────────╣
║        │ PlayerState方案     │ Character方案       │ PlayerController方案║
╠════════╬═════════════════════╬═════════════════════╬═════════════╣
║ 适用   │ 玩家角色            │ AI敌人              │ ❌ 不推荐     ║
║ 对象   │                     │ （简单情况）         │              ║
╠════════╬═════════════════════╬═════════════════════╬═════════════╣
║ 跨关卡 │ ✅ 自动持久          │ ❌ 换关卡就消失     │ ✅ 持久      ║
║ 持久   │ (PlayerState存在)   │ (Character被销毁)   │              ║
╠════════╬═════════════════════╬═════════════════════╬═════════════╣
║ 网络   │ ✅ 完美             │ ⚠️ 需额外处理       │ ❌ 问题多    ║
║ 同步   │ (PlayerState同步)   │                      │              ║
╠════════╬═════════════════════╬═════════════════════╬═════════════╣
║ 简单性 │ ⚠️ 需通过接口访问    │ ✅ 直接访问         │ ❌            ║
╠════════╬═════════════════════╬═════════════════════╬═════════════╣
║ 官方   │ ✅ 推荐（玩家）     │ ✅ 推荐（AI）       │ ❌ 不推荐     ║
║ 推荐   │                     │                     │              ║
╚════════╩═════════════════════╩═════════════════════╩═════════════╝
```

### 方案A：放在PlayerState（官方推荐，玩家角色用）

```
为什么推荐PlayerState？

理由1：生命周期正确
  ┌──────────────────────────────────────────────────┐
  │  PlayerState在玩家进入游戏时创建，离开时销毁       │
  │  关卡切换时PlayerState保留（Character被销毁重建）  │
  │                                                    │
  │  假设玩家在"村子"关卡学会了"火球术"                 │
  │  进入"地下城"关卡后，火球术还在吗？                  │
  │                                                    │
  │  ┌─────────────┐    ┌─────────────┐               │
  │  │ PlayerState │───▶│ ✅ 还在！   │               │
  │  │ (持久的)     │    │ 火球术保留   │               │
  │  └─────────────┘    └─────────────┘               │
  │                                                    │
  │  ┌─────────────┐    ┌─────────────┐               │
  │  │ Character   │───▶│ ❌ 没了！   │               │
  │  │ (被销毁的)   │    │ 火球术丢失   │               │
  │  └─────────────┘    └─────────────┘               │
  └──────────────────────────────────────────────────┘

理由2：网络同步完美
  PlayerState本身就是为网络同步设计的，ASC放在上面天然获得：
  • 属性自动同步
  • 客户端和服务器一致的状态
  • 旁观者也能正确看到

理由3：分离关注点
  PlayerState = 玩家的"数据"（属性、技能、等级）
  Character = 玩家的"表现"（模型、动画、移动）
  这是经典的"数据-表现"分离架构
```

```cpp
// ✅ 正确示例：ASC放在PlayerState
UCLASS()
class MYGAME_API AMyPlayerState : public APlayerState
{
    GENERATED_BODY()

public:
    AMyPlayerState();

    // ASC放在这里 —— 随PlayerState跨关卡持久
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "GAS")
    class UAbilitySystemComponent* AbilitySystemComponent;

    // AttributeSet也放在这里（属性应该和ASC在一起）
    UPROPERTY()
    class UMyAttributeSet* AttributeSet;

    // 实现IAbilitySystemInterface接口（后面会讲）
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;
};
```

### 方案B：放在Character（简单直接，AI用）

```cpp
// ✅ 正确示例：ASC放在Character（适合AI敌人）
UCLASS()
class MYGAME_API AMyAICharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AMyAICharacter();

    // ASC直接放在Character上
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "GAS")
    class UAbilitySystemComponent* AbilitySystemComponent;

    UPROPERTY()
    class UMyAttributeSet* AttributeSet;

    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;
};
```

**为什么AI适合放在Character上？**

- AI不会切换关卡（在当前关卡出生，当前关卡死亡）
- AI不存在PlayerState（玩家专用）
- 简单直接，不需要通过接口间接访问

### 方案C：放在PlayerController（不推荐）

```cpp
// ❌ 不推荐：ASC放在PlayerController
// 原因：
// 1. PlayerController在专用服务器模式下可能不存在
// 2. 一个PC可以控制多个Pawn（如载具系统），难以管理
// 3. PlayerController不应承担数据存储职责
// 4. 与官方推荐的设计模式背道而驰
```

---

## IAbilitySystemInterface 接口

由于ASC可能不在Character上（放在PlayerState），我们需要一个统一的访问方式。这就是`IAbilitySystemInterface`的作用。

```cpp
// ===== IAbilitySystemInterface 定义（引擎源码，不用你写）=====
// 在 AbilitySystemInterface.h 中

UINTERFACE(MinimalAPI, Blueprintable)
class UAbilitySystemInterface : public UInterface
{
    GENERATED_BODY()
};

// 接口只定义了一个函数：获取ASC
class GAMEPLAYABILITIES_API IAbilitySystemInterface
{
    GENERATED_BODY()

public:
    // 纯虚函数 —— 所有实现类必须重写
    // 返回这个Actor拥有的ASC
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const = 0;
};
```

**使用接口的好处**：任何代码想要和GAS交互时，不需要知道ASC具体藏在哪个对象上，只需要调用：

```cpp
// ✅ 统一访问模式 —— 不管ASC在哪，获取方式都一样

// 获取ASC的标准方式
UAbilitySystemComponent* GetASC(AActor* Actor)
{
    // 第一步：检查Actor是否实现了IAbilitySystemInterface
    IAbilitySystemInterface* GASInterface =
        Cast<IAbilitySystemInterface>(Actor);

    if (GASInterface)
    {
        // 通过接口获取ASC —— 不管ASC在PlayerState还是Character上
        return GASInterface->GetAbilitySystemComponent();
    }

    return nullptr;
}

// 使用示例：对目标造成伤害
void DealDamageToTarget(AActor* SourceActor, AActor* TargetActor, float Damage)
{
    // 获取源和目标的ASC
    UAbilitySystemComponent* SourceASC = GetASC(SourceActor);
    UAbilitySystemComponent* TargetASC = GetASC(TargetActor);

    if (SourceASC && TargetASC)
    {
        // 通过ASC应用伤害...（后面章节会详细讲）
    }
}
```

---

## 创建和初始化ASC

### 完整示例：PlayerState方案的创建流程

```cpp
// ===== MyPlayerState.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "AbilitySystemInterface.h"        // GAS接口
#include "MyPlayerState.generated.h"

UCLASS()
class MYGAME_API AMyPlayerState : public APlayerState,
                                   public IAbilitySystemInterface  // 实现GAS接口
{
    GENERATED_BODY()

public:
    AMyPlayerState();

    // ===== IAbilitySystemInterface 必须实现的方法 =====
    // 返回这个玩家状态拥有的ASC
    virtual class UAbilitySystemComponent* GetAbilitySystemComponent() const override;

    // ===== 属性集获取 =====
    // 方便其他代码快速获取属性集
    template <class T>
    T* GetAttributeSet() const
    {
        // 从ASC上查找指定类型的AttributeSet
        return AbilitySystemComponent ?
            const_cast<T*>(AbilitySystemComponent->GetAttributeSet<T>()) : nullptr;
    }

protected:
    // ===== GAS核心组件 =====

    // ASC - 技能系统的大脑
    // VisibleAnywhere: 在编辑器中可见（但不能编辑）
    // BlueprintReadOnly: 蓝图可以读取
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "GAS")
    class UAbilitySystemComponent* AbilitySystemComponent;

    // AttributeSet - 属性集合
    // 用UPROPERTY标记，防止被垃圾回收
    UPROPERTY()
    class UMyAttributeSet* AttributeSet;

    // ===== 初始化 =====
    virtual void BeginPlay() override;
};
```

```cpp
// ===== MyPlayerState.cpp =====
#include "MyPlayerState.h"
#include "AbilitySystemComponent.h"
#include "MyAttributeSet.h"

AMyPlayerState::AMyPlayerState()
{
    // 在构造函数中创建ASC组件
    // CreateDefaultSubobject 是UE创建子对象的标准方法
    AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(
        TEXT("AbilitySystemComponent")  // 子对象名称（调试用）
    );

    // 设置ASC的网络复制模式
    // Mixed模式：部分数据复制到所有客户端，部分仅复制到Owner
    AbilitySystemComponent->SetReplicationMode(
        EGameplayEffectReplicationMode::Mixed
    );

    // ⚠️ 重要：PlayerState本身就是Actor，默认开启网络同步
    // 所以ASC会自动获得网络复制能力
    // NetUpdateFrequency 在PlayerState中默认已设置
}

UAbilitySystemComponent* AMyPlayerState::GetAbilitySystemComponent() const
{
    return AbilitySystemComponent;
}

void AMyPlayerState::BeginPlay()
{
    Super::BeginPlay();

    // 安全检查
    if (!AbilitySystemComponent)
    {
        UE_LOG(LogTemp, Error, TEXT("AMyPlayerState: ASC is null!"));
        return;
    }

    // 创建并注册属性集
    if (IsValid(AbilitySystemComponent))
    {
        // CreateDefaultSubobject 在工作，但AttributeSet不在构造函数创建
        // 因为AttributeSet在BeginPlay时初始化更安全
        AttributeSet = NewObject<UMyAttributeSet>(this);

        // 把AttributeSet注册到ASC
        AbilitySystemComponent->AddAttributeSetSubobject(AttributeSet);
    }

    // 初始化默认属性（后面章节详讲）
    // InitDefaultAttributes();

    // 授予默认技能（后面章节详讲）
    // GiveDefaultAbilities();
}
```

### ASC的网络复制模式

ASC有三种复制模式，在创建ASC时必须选择正确的模式：

| 模式      | 说明                                       | 适用场景                 |
| --------- | ------------------------------------------ | ------------------------ |
| `Full`    | 所有GE复制到所有客户端                     | 简单、数据量大，不推荐   |
| `Mixed`   | GE复制到拥有者客户端，简化的GE复制到模拟端 | **推荐**，玩家角色用这个 |
| `Minimal` | 只有最小量的GE复制                         | AI敌人用这个             |

```cpp
// ✅ 玩家角色（ASC在PlayerState）使用Mixed模式
AbilitySystemComponent->SetReplicationMode(
    EGameplayEffectReplicationMode::Mixed
);

// ✅ AI敌人（ASC在Character）使用Minimal模式
AbilitySystemComponent->SetReplicationMode(
    EGameplayEffectReplicationMode::Minimal
);

// ❌ 不推荐使用Full模式——浪费带宽
// AbilitySystemComponent->SetReplicationMode(
//     EGameplayEffectReplicationMode::Full
// );
```

---

## ASC的Owner和Avatar分离设计

这是理解GAS架构的一个关键概念。

```
┌──────────────────────────────────────────────────────────────────┐
│              Owner vs Avatar —— 两个不同的角色                     │
│                                                                   │
│  ┌─────────────────────┐        ┌─────────────────────┐         │
│  │     Owner Actor     │        │     Avatar Actor    │         │
│  │     (逻辑持有者)     │        │     (物理代表)       │         │
│  ├─────────────────────┤        ├─────────────────────┤         │
│  │ PlayerState         │        │ Character (Pawn)     │         │
│  │ (跨关卡持久)        │        │ (当关卡存在)         │         │
│  └────────┬────────────┘        └────────┬────────────┘         │
│           │                              │                       │
│           └──────────┬───────────────────┘                       │
│                      ▼                                           │
│           ┌─────────────────────┐                                │
│           │       ASC           │                                │
│           │                     │                                │
│           │ OwnerActor: PS      │  ← 逻辑持有，永不销毁          │
│           │ AvatarActor: Char   │  ← 物理表现，换关重建          │
│           └─────────────────────┘                                │
│                                                                   │
│  为什么要分离？                                                   │
│                                                                   │
│  • Owner = 数据的主人（PlayerState不会因为重生而销毁）              │
│    → 技能、属性、Buff应该跟随Owner                                │
│                                                                   │
│  • Avatar = 物理表现（Character可能被销毁和重建）                   │
│    → 关卡切换/AI Spawning时Avatar改变，但数据保留                   │
│                                                                   │
│  举例说明：                                                       │
│  玩家在游戏中死亡，Character被销毁（尸体消失），然后重生              │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐                  │
│  │ Owner不变  │──▶│ 旧Avatar  │──▶│ 新Avatar  │                  │
│  │ (PlayerSt) │   │ (死亡)    │   │ (复活)    │                  │
│  │ 技能保留   │   │ 被销毁    │   │ 重新创建   │                  │
│  └───────────┘   └───────────┘   └───────────┘                  │
│  属性/技能/冷却继续存在           新的Character继承所有数据        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

```cpp
// ASC的Owner和Avatar设置

// 初始化时设置Owner和Avatar
void AMyPlayerState::SetAvatarActorForASC(AActor* InAvatarActor)
{
    if (AbilitySystemComponent)
    {
        // OwnerActor通常是PlayerState本身（生命周期最长）
        // AvatarActor是实际的Character/Pawn（物理表现）
        AbilitySystemComponent->InitAbilityActorInfo(
            this,            // OwnerActor  —— 逻辑持有者（PlayerState）
            InAvatarActor    // AvatarActor —— 物理代表（Character）
        );
    }
}

// 也可以在Character的PossessedBy中设置
void AMyCharacter::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);

    // 获取PlayerState
    AMyPlayerState* PS = GetPlayerState<AMyPlayerState>();
    if (PS)
    {
        // 告诉ASC：这个Character是你的Avatar
        PS->SetAvatarActorForASC(this);
    }
}
```

---

## ASC的核心功能详解

### 功能1：给予技能 (GiveAbility)

```
GiveAbility = 把一个技能"安装"到角色身上
注意：给予技能 ≠ 激活技能
     给予后技能只是"可用"状态，等待触发条件
```

```cpp
// ===== 给予技能 =====

// 方式1：直接传入GA类
void GiveAbilityByClass(UAbilitySystemComponent* ASC, TSubclassOf<UGameplayAbility> AbilityClass)
{
    // 创建一个技能规格描述
    FGameplayAbilitySpec AbilitySpec(
        AbilityClass,    // 技能类
        1,               // 技能等级（默认1）
        INDEX_NONE       // InputID（如果用EnhancedInput，这里可以绑定）
    );

    // 把技能规格给予ASC
    // GiveAbility 返回一个句柄（FGameplayAbilitySpecHandle），用于后续操作
    FGameplayAbilitySpecHandle Handle = ASC->GiveAbility(AbilitySpec);

    // 可以通过Handle来查找、修改或移除技能
}

// 方式2：批量给予默认技能（通常在BeginPlay中调用）
void GiveDefaultAbilities(UAbilitySystemComponent* ASC,
                          const TArray<TSubclassOf<UGameplayAbility>>& DefaultAbilities)
{
    // 循环给予所有默认技能
    for (TSubclassOf<UGameplayAbility> AbilityClass : DefaultAbilities)
    {
        if (AbilityClass)
        {
            // 给每个技能分配一个唯一InputID
            int32 InputID = static_cast<int32>(AbilityClass->GetDefaultObject()->GetUniqueID());

            FGameplayAbilitySpec Spec(AbilityClass, 1, InputID);
            ASC->GiveAbility(Spec);
        }
    }
}

// ✅ 正确：给予技能（只是"安装"，不立即执行）
ASC->GiveAbility(FGameplayAbilitySpec(UFireballAbility::StaticClass(), 1, 0));

// ❌ 错误：不能直接创建技能实例然后激活
// UGameplayAbility* Ability = NewObject<UFireballAbility>();
// Ability->ActivateAbility(...);  // 这样绕过了ASC，不触发安全检查
```

### 功能2：激活技能 (TryActivateAbility)

```
TryActivateAbility = 让ASC帮你检查所有条件，通过后才执行技能

ASC的自动检查清单：
☑ 技能已经被给予了吗？（Give状态）
☑ 技能标签条件满足吗？（Activation Required/Blocked Tags）
☑ 角色有必需的标签吗？
☑ 角色没有阻塞的标签吗？
☑ 冷却好了吗？
☑ 角色还活着吗？（没有State.Dead标签）
```

```cpp
// ===== 激活技能的多种方式 =====

// 方式1：通过技能类激活（最常用）
bool TryActivateByClass(UAbilitySystemComponent* ASC,
                        TSubclassOf<UGameplayAbility> AbilityClass)
{
    if (!ASC || !AbilityClass)
    {
        return false;
    }

    // TryActivateAbilityByClass 会：
    // 1. 查找这个GA的Spec
    // 2. 检查所有激活条件（标签、冷却等）
    // 3. 如果条件满足，调用 GA::ActivateAbility()
    // 4. 返回是否成功激活
    return ASC->TryActivateAbilityByClass(AbilityClass);
}

// 方式2：通过技能标签激活
// 如果你给技能配置了Ability Tags，可以用标签激活
bool TryActivateByTag(UAbilitySystemComponent* ASC,
                      const FGameplayTag& AbilityTag)
{
    // 通过标签查找并激活匹配的技能
    return ASC->TryActivateAbilitiesByTag(
        FGameplayTagContainer(AbilityTag)  // 需要包装成Container
    );
}

// 方式3：通过InputID激活（配合EnhancedInput）
void TryActivateByInputID(UAbilitySystemComponent* ASC, int32 InputID)
{
    // 遍历所有已给予的技能，找到InputID匹配的
    for (const FGameplayAbilitySpec& Spec : ASC->GetActivatableAbilities())
    {
        if (Spec.InputID == InputID)
        {
            ASC->TryActivateAbility(Spec.Handle);
            break;
        }
    }
}

// 方式4：通过Spec Handle激活
bool TryActivateByHandle(UAbilitySystemComponent* ASC,
                         FGameplayAbilitySpecHandle Handle)
{
    return ASC->TryActivateAbility(Handle);
}
```

### 功能3：应用效果 (ApplyGameplayEffect)

```
应用GE = 对目标施加一个效果（伤害、治疗、Buff、Debuff等）

核心API：
  ApplyGameplayEffectToSelf    → 对自己应用效果（如喝药水）
  ApplyGameplayEffectToTarget  → 对目标应用效果（如对敌人造成伤害）
  MakeOutgoingSpec             → 创建GE的实例（Spec），设置动态参数
  ApplyGameplayEffectSpecToSelf   → 对自身应用Spec
  ApplyGameplayEffectSpecToTarget → 对目标应用Spec
```

```cpp
// ===== 应用效果到自身 =====
// 场景：玩家喝了一瓶恢复药水

void DrinkHealthPotion(UAbilitySystemComponent* ASC,
                       TSubclassOf<UGameplayEffect> HealthPotionGE)
{
    if (!ASC || !HealthPotionGE)
    {
        return;
    }

    // 方式1：直接应用GE类（简单情况）
    // 参数：GE类, 等级, 上下文
    FGameplayEffectContextHandle Context = ASC->MakeEffectContext();
    ASC->ApplyGameplayEffectToSelf(
        HealthPotionGE->GetDefaultObject<UGameplayEffect>(),
        1,        // 等级
        Context   // 上下文（包含Instigator等信息）
    );
}

// ===== 应用效果到目标 =====
// 场景：对敌人造成伤害（使用Spec模式，设置动态伤害值）

void DealDamageToTarget(UAbilitySystemComponent* SourceASC,
                        UAbilitySystemComponent* TargetASC,
                        TSubclassOf<UGameplayEffect> DamageGE,
                        float DamageAmount)
{
    if (!SourceASC || !TargetASC || !DamageGE)
    {
        return;
    }

    // 步骤1：创建上下文（包含施法者、目标等信息）
    FGameplayEffectContextHandle EffectContext = SourceASC->MakeEffectContext();
    // EffectContext中自动包含了Instigator（由ASC的OwnerActor决定）

    // 步骤2：创建Spec——GE的"实例"
    // Spec = GE模板 + 动态参数（如具体的伤害值）
    FGameplayEffectSpecHandle SpecHandle = SourceASC->MakeOutgoingSpec(
        DamageGE,        // 使用哪个GE作为模板
        1,               // 技能等级
        EffectContext    // 上下文
    );

    if (SpecHandle.IsValid())
    {
        // 步骤3：设置动态参数（"调用者设定的值"）
        // SetByCaller 允许你在运行时设定GE中的Scalable Float值
        SpecHandle.Data->SetSetByCallerMagnitude(
            FGameplayTag::RequestGameplayTag(FName("Data.Damage")),
            DamageAmount
        );

        // 步骤4：应用Spec到目标
        SourceASC->ApplyGameplayEffectSpecToTarget(
            *SpecHandle.Data.Get(),
            TargetASC
        );
    }
}

// ❌ 常见错误：直接修改目标的属性
// 不要这样做！
// TargetASC->SetNumericAttributeBase(HealthAttribute, NewValue);
// 应该通过GE来修改——这样GAS才能追踪修改来源、处理回调
```

### 功能4：查询属性值

```cpp
// ===== 查询属性的当前值 =====

// 方式1：通过属性名查询（返回当前值，包含所有GE的加成）
float GetHealth(UAbilitySystemComponent* ASC)
{
    // 获取属性定义
    FGameplayAttribute HealthAttribute = UMyAttributeSet::GetHealthAttribute();

    // 查询当前值
    float Health = 0.0f;
    if (ASC->GetGameplayAttributeValue(HealthAttribute, Health))
    {
        return Health;
    }

    return 0.0f;
}

// 方式2：通过AttributeSet直接获取（需要先获取AttributeSet）
float GetHealthDirect(UAbilitySystemComponent* ASC)
{
    const UMyAttributeSet* AttributeSet = ASC->GetAttributeSet<UMyAttributeSet>();
    if (AttributeSet)
    {
        return AttributeSet->GetHealth();  // 使用AttributeSet中的访问器
    }
    return 0.0f;
}

// 方式3：查询属性的基础值（BaseValue，不包含临时GE的加成）
float GetBaseHealth(UAbilitySystemComponent* ASC)
{
    FGameplayAttribute HealthAttribute = UMyAttributeSet::GetHealthAttribute();

    float BaseValue = 0.0f;
    ASC->GetGameplayAttributeValue(HealthAttribute, BaseValue);  // 这实际返回的是CurrentValue

    // 要获取BaseValue，需要：
    bool bFound = false;
    float RealBaseValue = ASC->GetGameplayAttributeBaseValue(HealthAttribute, bFound);
    return bFound ? RealBaseValue : 0.0f;
}
```

### 功能5：标签管理

```cpp
// ===== 手动管理ASC上的标签 =====
// 注意：大多数标签由GE自动管理，手动添加的场景较少

void ManageLooseTags(UAbilitySystemComponent* ASC)
{
    // 创建一个标签
    FGameplayTag StunTag = FGameplayTag::RequestGameplayTag(
        FName("State.CC.Stun")
    );

    // ✅ 添加一个"松散标签"（不属于任何GE，手动管理）
    ASC->AddLooseGameplayTag(StunTag);
    // 现在 ASC->HasMatchingGameplayTag(StunTag) 返回 true

    // 查询是否有标签
    if (ASC->HasMatchingGameplayTag(StunTag))
    {
        // 角色处于眩晕状态
    }

    // ✅ 移除松散标签
    ASC->RemoveLooseGameplayTag(StunTag);

    // ✅ 批量添加
    FGameplayTagContainer TagsToAdd;
    TagsToAdd.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Combat.InCombat")));
    TagsToAdd.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Combat.Casting")));
    ASC->AddLooseGameplayTags(TagsToAdd);

    // ✅ 查询是否有容器中任意标签
    FGameplayTagContainer CC_Tags;
    CC_Tags.AddTag(FGameplayTag::RequestGameplayTag(FName("State.CC")));
    if (ASC->HasAnyMatchingGameplayTags(CC_Tags))
    {
        // 角色被任何一种控制效果影响（因为State.CC会匹配所有子标签）
    }

    // ✅ 获取ASC当前拥有的所有标签（用于调试）
    FGameplayTagContainer AllTags;
    ASC->GetOwnedGameplayTags(AllTags);
    for (const FGameplayTag& Tag : AllTags)
    {
        UE_LOG(LogTemp, Log, TEXT("角色有标签: %s"), *Tag.ToString());
    }
}
```

---

## ASC完整代码示例

### PlayerState方案完整示例

```cpp
// ===== MyPlayerState.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "AbilitySystemInterface.h"
#include "GameplayEffectTypes.h"
#include "MyPlayerState.generated.h"

// 前向声明
class UAbilitySystemComponent;
class UMyAttributeSet;

UCLASS()
class MYGAME_API AMyPlayerState : public APlayerState,
                                   public IAbilitySystemInterface
{
    GENERATED_BODY()

public:
    AMyPlayerState();

    // ===== IAbilitySystemInterface =====
    UFUNCTION(BlueprintCallable, Category = "GAS")
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

    // ===== 便捷访问AttributeSet =====
    UFUNCTION(BlueprintCallable, Category = "GAS")
    UMyAttributeSet* GetMyAttributeSet() const
    {
        if (!AttributeSet)
        {
            // 从ASC中查找
            return AbilitySystemComponent ?
                const_cast<UMyAttributeSet*>(
                    AbilitySystemComponent->GetAttributeSet<UMyAttributeSet>()
                ) : nullptr;
        }
        return AttributeSet;
    }

    // ===== 授予默认技能 =====
    void GiveDefaultAbilities();

    // ===== 初始化默认属性 =====
    void InitDefaultAttributes();

protected:
    // ===== GAS核心组件 =====
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "GAS")
    UAbilitySystemComponent* AbilitySystemComponent;

    UPROPERTY()
    UMyAttributeSet* AttributeSet;

    // ===== 配置用的默认值（在蓝图中设置）=====
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "GAS|Defaults")
    TArray<TSubclassOf<class UGameplayAbility>> DefaultAbilities;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "GAS|Defaults")
    TSubclassOf<class UGameplayEffect> DefaultAttributeGE;

    virtual void BeginPlay() override;
};
```

```cpp
// ===== MyPlayerState.cpp =====
#include "MyPlayerState.h"
#include "AbilitySystemComponent.h"
#include "MyAttributeSet.h"
#include "GameplayEffect.h"

AMyPlayerState::AMyPlayerState()
{
    // 创建ASC组件
    AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(
        TEXT("AbilitySystemComponent")
    );

    // 设置为Mixed网络复制模式（玩家使用）
    AbilitySystemComponent->SetReplicationMode(
        EGameplayEffectReplicationMode::Mixed
    );
}

UAbilitySystemComponent* AMyPlayerState::GetAbilitySystemComponent() const
{
    return AbilitySystemComponent;
}

void AMyPlayerState::BeginPlay()
{
    Super::BeginPlay();

    if (!AbilitySystemComponent)
    {
        UE_LOG(LogTemp, Error, TEXT("AMyPlayerState::BeginPlay - ASC is null!"));
        return;
    }

    // 创建属性集并注册到ASC
    AttributeSet = NewObject<UMyAttributeSet>(this);
    AbilitySystemComponent->AddAttributeSetSubobject(AttributeSet);

    // 初始化属性默认值
    InitDefaultAttributes();

    // 授予默认技能
    GiveDefaultAbilities();
}

void AMyPlayerState::InitDefaultAttributes()
{
    if (!AbilitySystemComponent || !DefaultAttributeGE)
    {
        return;
    }

    // 创建一个效果上下文
    FGameplayEffectContextHandle Context = AbilitySystemComponent->MakeEffectContext();
    Context.AddSourceObject(this);  // 设置来源对象

    // 应用默认属性GE到自身
    // 注意：这里不能直接用类的CDO，因为GE的数据可能需要在Spec中定制
    FGameplayEffectSpecHandle SpecHandle =
        AbilitySystemComponent->MakeOutgoingSpec(DefaultAttributeGE, 1, Context);

    if (SpecHandle.IsValid())
    {
        AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(
            *SpecHandle.Data.Get()
        );
    }
}

void AMyPlayerState::GiveDefaultAbilities()
{
    if (!AbilitySystemComponent)
    {
        return;
    }

    // 循环给予所有默认技能
    for (int32 i = 0; i < DefaultAbilities.Num(); i++)
    {
        TSubclassOf<UGameplayAbility> AbilityClass = DefaultAbilities[i];
        if (AbilityClass)
        {
            FGameplayAbilitySpec AbilitySpec(
                AbilityClass,
                1,    // Level
                i     // InputID（对应输入绑定的顺序）
            );
            AbilitySystemComponent->GiveAbility(AbilitySpec);
        }
    }
}
```

---

## ASC常用的调试命令

```cpp
// 在游戏中打开控制台(~)，输入以下命令进行调试

// 显示ASC调试信息
showdebug abilitysystem

// 显示所有已给予的技能
// (自定义log，需要在代码中实现)

// 显示所有激活的GE
// (自定义log，需要在代码中实现)

// 显示所有当前标签
// (自定义log，需要在代码中实现)

// 在C++代码中添加调试日志：
void DebugPrintASCInfo(UAbilitySystemComponent* ASC)
{
    if (!ASC) return;

    // 打印所有者信息
    UE_LOG(LogTemp, Warning, TEXT("=== ASC Debug Info ==="));
    UE_LOG(LogTemp, Warning, TEXT("Owner: %s"),
        ASC->GetOwnerActor() ? *ASC->GetOwnerActor()->GetName() : TEXT("None"));
    UE_LOG(LogTemp, Warning, TEXT("Avatar: %s"),
        ASC->GetAvatarActor() ? *ASC->GetAvatarActor()->GetName() : TEXT("None"));

    // 打印所有技能
    UE_LOG(LogTemp, Warning, TEXT("--- Abilities ---"));
    for (const FGameplayAbilitySpec& Spec : ASC->GetActivatableAbilities())
    {
        UE_LOG(LogTemp, Warning, TEXT("  [%s] Level:%d Active:%d"),
            Spec.Ability ? *Spec.Ability->GetName() : TEXT("None"),
            Spec.Level,
            Spec.IsActive()
        );
    }

    // 打印所有标签
    UE_LOG(LogTemp, Warning, TEXT("--- Tags ---"));
    FGameplayTagContainer AllTags;
    ASC->GetOwnedGameplayTags(AllTags);
    for (const FGameplayTag& Tag : AllTags)
    {
        UE_LOG(LogTemp, Warning, TEXT("  %s"), *Tag.ToString());
    }
}
```

---

## 常见错误与排查

```
┌─────────────────────────────────────────────────────────────────┐
│                   ASC 常见错误排查指南                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ❌ 错误："技能无法激活"                                          │
│    排查步骤：                                                   │
│    1. 技能被 Give 了吗？检查 GiveAbility 是否被调用             │
│    2. 标签条件满足吗？用 HasMatchingGameplayTag 检查            │
│    3. ASC的InitAbilityActorInfo被调用了吗？                     │
│    4. 是服务器端吗？有些技能只在服务器执行                      │
│                                                                 │
│ ❌ 错误："GE没有生效"                                            │
│    排查步骤：                                                   │
│    1. GE类正确吗？检查TSubclassOf是否正确配置                   │
│    2. 目标有ASC吗？检查GetAbilitySystemComponent是否返回有效值  │
│    3. 标签条件满足吗？GE可能有Application Tag Requirements      │
│    4. 属性名正确吗？检查AttributeSet的变量名                    │
│                                                                 │
│ ❌ 错误："属性没有网络同步"                                      │
│    排查步骤：                                                   │
│    1. AttributeSet中的属性用了ReplicatedUsing吗？               │
│    2. DOREPLIFETIME_CONDITION_NOTIFY写了吗？                   │
│    3. OnRep函数实现了吗？                                       │
│    4. 检查ASC的复制模式                                        │
│                                                                 │
│ ❌ 错误："跨关卡后技能丢失"                                      │
│    原因：ASC放在了Character上，换关卡时Character被销毁了         │
│    解决：把ASC移到PlayerState上                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 完成检查清单

- [ ] 你能说出ASC的三种放置位置及其优缺点吗？
- [ ] 你理解为什么官方推荐玩家用PlayerState、AI用Character放置ASC吗？
- [ ] 你能写出ASC的创建和初始化代码吗？
- [ ] 你理解IAbilitySystemInterface的作用和用法吗？
- [ ] 你能区分GiveAbility和TryActivateAbility的区别吗？
- [ ] 你知道ASC的三种网络复制模式及其适用场景吗？
- [ ] 你理解Owner和Avatar分离设计的目的吗？
- [ ] 你能写出ApplyGameplayEffect的完整代码（包含动态伤害设置）吗？

---

> **下一节**：[13.3 GameplayAbility](./03-GameplayAbility.md) — 技能的定义和生命周期
