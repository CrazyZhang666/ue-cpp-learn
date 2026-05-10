# 13.6 AttributeSet (AS)

> **目标**：全面掌握AttributeSet的定义、属性类型、网络同步和变化回调机制。

---

## AttributeSet是什么

```
┌───────────────────────────────────────────────────────────────────┐
│           AttributeSet (AS) = 属性的"集合卡片"                      │
│                                                                     │
│  类比：D&D（龙与地下城）角色卡上的属性栏                            │
│                                                                     │
│  ┌──────────────────────────────────────┐                          │
│  │        角色属性卡                     │                          │
│  │                                      │                          │
│  │  生命值 (Health):     100 / 100      │  ← 这是一个属性             │
│  │  法力值 (Mana):        50 / 200      │  ← 这是另一个属性           │
│  │  攻击力 (AttackPower):  85           │                          │
│  │  防御力 (Defense):       40           │                          │
│  │  移动速度 (MoveSpeed):  600          │                          │
│  │                                      │                          │
│  │  AttributeSet 就是把所有这些属性      │                          │
│  │  打包在一起的"卡片"                   │                          │
│  └──────────────────────────────────────┘                          │
│                                                                     │
│  但GAS的AttributeSet比纸面属性卡强大多了：                           │
│  • 属性值自动网络同步                                               │
│  • 属性变化自动触发回调（用于Clamp、死亡处理等）                     │
│  • 属性修改来源可追踪（哪个GE、谁施放的）                             │
│  • 支持临时/永久修改器分离                                           │
│  • 属性间可以有关联关系                                             │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## AttributeSet的基本结构

```cpp
// ===== MyAttributeSet.h —— 属性集的基本结构 =====
#pragma once

#include "CoreMinimal.h"
#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "MyAttributeSet.generated.h"

// ===== ATTRIBUTE_ACCESSORS 宏 —— 这是GAS提供的一个便捷宏 =====
// 它自动生成每个属性的 Get/Set/Init 函数
// 让我们不需要手写每个属性的访问器

// 这个宏定义在 AttributeSet.h 中：
// #define ATTRIBUTE_ACCESSORS(ClassName, PropertyName)
//     static FGameplayAttribute Get##PropertyName##Attribute();
//     float Get##PropertyName() const;
//     void Set##PropertyName(float NewVal);
//     void Init##PropertyName(float NewVal);

/**
 * 角色属性集
 *
 * 包含所有可被GameplayEffect修改的角色属性
 * 每个属性使用 FGameplayAttributeData 类型
 */
UCLASS()
class MYGAME_API UMyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    UMyAttributeSet();

    // ===== 生命值属性 =====
    // ReplicatedUsing = 网络同步时触发OnRep函数
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Health,
              Category = "Attributes|Vital")
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)  // 自动生成GetHealth/SetHealth/InitHealth

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxHealth,
              Category = "Attributes|Vital")
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxHealth)

    // ===== 法力值属性 =====
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Mana,
              Category = "Attributes|Vital")
    FGameplayAttributeData Mana;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Mana)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxMana,
              Category = "Attributes|Vital")
    FGameplayAttributeData MaxMana;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxMana)

    // ===== 体力值属性 =====
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Stamina,
              Category = "Attributes|Vital")
    FGameplayAttributeData Stamina;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Stamina)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxStamina,
              Category = "Attributes|Vital")
    FGameplayAttributeData MaxStamina;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxStamina)

    // ===== 战斗属性 =====
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_AttackPower,
              Category = "Attributes|Combat")
    FGameplayAttributeData AttackPower;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, AttackPower)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Defense,
              Category = "Attributes|Combat")
    FGameplayAttributeData Defense;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Defense)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_CriticalChance,
              Category = "Attributes|Combat")
    FGameplayAttributeData CriticalChance;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, CriticalChance)

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_CriticalDamage,
              Category = "Attributes|Combat")
    FGameplayAttributeData CriticalDamage;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, CriticalDamage)

    // ===== 移动属性 =====
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MoveSpeed,
              Category = "Attributes|Movement")
    FGameplayAttributeData MoveSpeed;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MoveSpeed)

    // ===== 属性变化回调 =====

    // 属性修改前回调 —— 用于Clamp（限制值域）
    virtual void PreAttributeChange(
        const FGameplayAttribute& Attribute,
        float& NewValue
    ) override;

    // GE执行后回调 —— 用于处理"死亡的连锁反应"等
    virtual void PostGameplayEffectExecute(
        const FGameplayEffectModCallbackData& Data
    ) override;

    // 属性应用后回调（所有GE计算完成后）
    virtual void PreAttributeBaseChange(
        const FGameplayAttribute& Attribute,
        float& NewValue
    ) const override;

    virtual void PostAttributeChange(
        const FGameplayAttribute& Attribute,
        float OldValue,
        float NewValue
    ) override;

protected:
    // ===== 网络同步回调 =====
    // 当属性从服务器同步到客户端时调用
    // 用于更新UI等客户端表现

    UFUNCTION()
    virtual void OnRep_Health(const FGameplayAttributeData& OldHealth);

    UFUNCTION()
    virtual void OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth);

    UFUNCTION()
    virtual void OnRep_Mana(const FGameplayAttributeData& OldMana);

    UFUNCTION()
    virtual void OnRep_MaxMana(const FGameplayAttributeData& OldMaxMana);

    UFUNCTION()
    virtual void OnRep_Stamina(const FGameplayAttributeData& OldStamina);

    UFUNCTION()
    virtual void OnRep_MaxStamina(const FGameplayAttributeData& OldMaxStamina);

    UFUNCTION()
    virtual void OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower);

    UFUNCTION()
    virtual void OnRep_Defense(const FGameplayAttributeData& OldDefense);

    UFUNCTION()
    virtual void OnRep_CriticalChance(const FGameplayAttributeData& OldCriticalChance);

    UFUNCTION()
    virtual void OnRep_CriticalDamage(const FGameplayAttributeData& OldCriticalDamage);

    UFUNCTION()
    virtual void OnRep_MoveSpeed(const FGameplayAttributeData& OldMoveSpeed);
};
```

### FGameplayAttributeData的内部结构

```cpp
// ===== FGameplayAttributeData 内部 =====
// （引擎源码，供理解）

USTRUCT(BlueprintType)
struct FGameplayAttributeData
{
    GENERATED_BODY()

    // 这部分由GAS管理
    // BaseValue: 永久值（装备、等级加成）
    // CurrentValue: 当前值 = BaseValue + 所有激活GE的临时修改
    // 正常情况下，BaseValue由Instant GE修改，CurrentValue由Duration GE修改

protected:
    UPROPERTY(BlueprintReadOnly, Category = "Attribute")
    float BaseValue = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "Attribute")
    float CurrentValue = 0.0f;

public:
    // 获取当前值（包含所有临时GE加成）
    float GetCurrentValue() const { return CurrentValue; }

    // 获取基础值（永久值，不含临时GE）
    float GetBaseValue() const { return BaseValue; }

    // 设置当前值（不应手动调用，由GAS管理）
    void SetCurrentValue(float NewValue) { CurrentValue = NewValue; }

    // 设置基础值（不应手动调用，由GAS管理）
    void SetBaseValue(float NewValue) { BaseValue = NewValue; }

    // operator float() 隐式转换，可以直接当float用
    operator float() const { return CurrentValue; }
};

// 所以以下两种写法是等价的：
// float hp1 = AttributeSet->Health.GetCurrentValue();  // 显式获取
// float hp2 = AttributeSet->Health;                     // 隐式转换，推荐
```

---

## AttributeSet的实现

```cpp
// ===== MyAttributeSet.cpp =====
#include "MyAttributeSet.h"
#include "GameplayEffectExtension.h"
#include "AbilitySystemComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Net/UnrealNetwork.h"

UMyAttributeSet::UMyAttributeSet()
{
    // 设置属性的默认值
    // 这些默认值在BeginPlay时通过InitFromMetaData或手动初始化

    // 生命值
    InitHealth(100.0f);
    InitMaxHealth(100.0f);

    // 法力值
    InitMana(200.0f);
    InitMaxMana(200.0f);

    // 体力值
    InitStamina(100.0f);
    InitMaxStamina(100.0f);

    // 战斗属性
    InitAttackPower(50.0f);
    InitDefense(30.0f);
    InitCriticalChance(0.05f);   // 5%暴击率
    InitCriticalDamage(1.5f);    // 150%暴击伤害

    // 移动速度
    InitMoveSpeed(600.0f);       // UE默认行走速度
}

// ===== 网络复制注册 =====
void UMyAttributeSet::GetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    // DOREPLIFETIME_CONDITION_NOTIFY 的三重含义：
    // 1. DOREPLIFETIME: 这个属性需要网络复制
    // 2. CONDITION: 复制条件（谁需要收到这个属性的同步）
    // 3. NOTIFY: 使用ReplicatedUsing指定的OnRep回调

    // ===== 生命值 =====
    // COND_None: 无条件复制给所有客户端
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, Health, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, MaxHealth, COND_None, REPNOTIFY_Always);

    // ===== 法力值 =====
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, Mana, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, MaxMana, COND_None, REPNOTIFY_Always);

    // ===== 体力值 =====
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, Stamina, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, MaxStamina, COND_None, REPNOTIFY_Always);

    // ===== 战斗属性 =====
    // COND_OwnerOnly: 只复制给拥有这个属性的玩家（防止敌人看到你的攻防）
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, AttackPower, COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, Defense, COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, CriticalChance, COND_OwnerOnly, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, CriticalDamage, COND_OwnerOnly, REPNOTIFY_Always);

    // ===== 移动速度 =====
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, MoveSpeed, COND_None, REPNOTIFY_Always);
}

// ===== PreAttributeChange —— 修改前回调 =====
// 在 GE 修改属性之前调用
// 主要用于 Clamp（限制值域）：确保属性值不超出合理范围

void UMyAttributeSet::PreAttributeChange(
    const FGameplayAttribute& Attribute,
    float& NewValue)
{
    // NewValue 是引用参数，可以修改它来钳制值域

    if (Attribute == GetHealthAttribute())
    {
        // 生命值不能小于0，不能大于最大生命值
        NewValue = FMath::Clamp(NewValue, 0.0f, GetMaxHealth());
    }
    else if (Attribute == GetManaAttribute())
    {
        // 法力值不能小于0，不能大于最大法力值
        NewValue = FMath::Clamp(NewValue, 0.0f, GetMaxMana());
    }
    else if (Attribute == GetStaminaAttribute())
    {
        // 体力值不能小于0，不能大于最大体力值
        NewValue = FMath::Clamp(NewValue, 0.0f, GetMaxStamina());
    }
    else if (Attribute == GetMaxHealthAttribute())
    {
        // 最大生命值不能小于1（否则除以0等问题）
        NewValue = FMath::Max(NewValue, 1.0f);
    }
    else if (Attribute == GetMaxManaAttribute())
    {
        NewValue = FMath::Max(NewValue, 1.0f);
    }
    else if (Attribute == GetMoveSpeedAttribute())
    {
        // 移动速度不能为负数
        NewValue = FMath::Max(NewValue, 0.0f);
    }
}

// ===== PostGameplayEffectExecute —— GE执行后回调 ⭐ 最重要 =====
// 在 GE 修改属性之后调用（只在服务器端调用）
// 用于处理 "属性被修改后" 的逻辑，如：死亡检测、连锁反应等

void UMyAttributeSet::PostGameplayEffectExecute(
    const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);

    // Data 包含的信息：
    // Data.Target       → 谁被修改了（Actor + ASC）
    // Data.EffectSpec   → 哪个GE的Spec修改了属性
    // Data.EvaluatedData → 修改了哪个属性，修改了多少

    // 获取修改的属性
    const FGameplayAttribute& ModifiedAttribute = Data.EvaluatedData.Attribute;

    // 获取修改量（Magnitude）
    float Magnitude = Data.EvaluatedData.Magnitude;

    // ===== 处理生命值变化 =====
    if (ModifiedAttribute == GetHealthAttribute())
    {
        // 生命值被修改后的事件

        // ✅ 正确：限制生命值范围
        float ClampedHealth = FMath::Clamp(GetHealth(), 0.0f, GetMaxHealth());
        SetHealth(ClampedHealth);

        // 检查是否死亡
        if (GetHealth() <= 0.0f)
        {
            // 角色死亡逻辑
            HandleDeath(Data);
        }
    }

    // ===== 处理法力值变化 =====
    else if (ModifiedAttribute == GetManaAttribute())
    {
        // 限制法力值范围
        float ClampedMana = FMath::Clamp(GetMana(), 0.0f, GetMaxMana());
        SetMana(ClampedMana);
    }

    // ===== 处理体力值变化 =====
    else if (ModifiedAttribute == GetStaminaAttribute())
    {
        float ClampedStamina = FMath::Clamp(GetStamina(), 0.0f, GetMaxStamina());
        SetStamina(ClampedStamina);
    }

    // ===== 处理移动速度变化 =====
    else if (ModifiedAttribute == GetMoveSpeedAttribute())
    {
        // 如果属性变化影响了角色的实际移动速度，在这里同步
        if (Data.Target.AvatarActor.IsValid())
        {
            ACharacter* Character = Cast<ACharacter>(Data.Target.AvatarActor);
            if (Character && Character->GetCharacterMovement())
            {
                // 更新CharacterMovement组件的速度
                Character->GetCharacterMovement()->MaxWalkSpeed = GetMoveSpeed();
            }
        }
    }
}

// ===== 死亡处理 =====
void UMyAttributeSet::HandleDeath(const FGameplayEffectModCallbackData& Data)
{
    // 获取目标的ASC
    UAbilitySystemComponent* TargetASC = Data.Target.AbilitySystemComponent.Get();
    if (!TargetASC) return;

    // 确保Health确实为0（防止其他修改把Health又改回正数）
    // 这里可能需要更多逻辑防止死而复生

    // 给目标ASC添加"死亡"标签
    TargetASC->AddLooseGameplayTag(
        FGameplayTag::RequestGameplayTag(FName("State.Dead"))
    );

    // 触发死亡事件
    // 这里可以调用蓝图事件或通过ASC广播事件
    // 让GameplayAbility响应死亡事件（播放死亡动画等）

    // 示例：发送GameplayEvent
    FGameplayEventData DeathEventData;
    DeathEventData.Instigator = Data.EffectSpec.GetEffectContext().GetInstigator();
    DeathEventData.Target = Data.Target.AvatarActor.Get();

    TargetASC->HandleGameplayEvent(
        FGameplayTag::RequestGameplayTag(FName("Event.Death")),
        &DeathEventData
    );
}

// ===== 网络同步回调 OnRep =====
// 当属性从服务器同步到客户端时被调用
// 主要用于更新UI或播放表现效果

void UMyAttributeSet::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
    // GAMEPLAYATTRIBUTE_REPNOTIFY 宏：
    // 1. 调用 PreAttributeChange / PostAttributeChange（如果需要）
    // 2. 触发属性变化的委托
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, OldHealth);

    // 在这里可以添加额外的客户端逻辑
    UE_LOG(LogTemp, Log, TEXT("Health changed from %.1f to %.1f"),
        OldHealth.GetCurrentValue(), Health.GetCurrentValue());
}

void UMyAttributeSet::OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, MaxHealth, OldMaxHealth);
}

void UMyAttributeSet::OnRep_Mana(const FGameplayAttributeData& OldMana)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Mana, OldMana);
}

void UMyAttributeSet::OnRep_MaxMana(const FGameplayAttributeData& OldMaxMana)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, MaxMana, OldMaxMana);
}

void UMyAttributeSet::OnRep_Stamina(const FGameplayAttributeData& OldStamina)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Stamina, OldStamina);
}

void UMyAttributeSet::OnRep_MaxStamina(const FGameplayAttributeData& OldMaxStamina)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, MaxStamina, OldMaxStamina);
}

void UMyAttributeSet::OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, AttackPower, OldAttackPower);
}

void UMyAttributeSet::OnRep_Defense(const FGameplayAttributeData& OldDefense)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Defense, OldDefense);
}

void UMyAttributeSet::OnRep_CriticalChance(const FGameplayAttributeData& OldCriticalChance)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, CriticalChance, OldCriticalChance);
}

void UMyAttributeSet::OnRep_CriticalDamage(const FGameplayAttributeData& OldCriticalDamage)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, CriticalDamage, OldCriticalDamage);
}

void UMyAttributeSet::OnRep_MoveSpeed(const FGameplayAttributeData& OldMoveSpeed)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, MoveSpeed, OldMoveSpeed);
}

void UMyAttributeSet::PreAttributeBaseChange(
    const FGameplayAttribute& Attribute,
    float& NewValue) const
{
    Super::PreAttributeBaseChange(Attribute, NewValue);
    // 基本值的预修改回调（用得少）
}

void UMyAttributeSet::PostAttributeChange(
    const FGameplayAttribute& Attribute,
    float OldValue,
    float NewValue)
{
    Super::PostAttributeChange(Attribute, OldValue, NewValue);
    // 属性完全修改后的回调（BaseValue和CurrentValue都确定后）
}
```

---

## CurrentValue vs BaseValue 详解

```
┌───────────────────────────────────────────────────────────────────┐
│            CurrentValue vs BaseValue —— 两个值的意义                 │
│                                                                     │
│  每个 FGameplayAttributeData 内部维护两个值：                        │
│                                                                     │
│  BaseValue (基础值/永久值)                                          │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  • 由 Instant GE 修改（如升级时永久加属性）          │          │
│  │  • 由 Infinite GE 修改（如装备附加属性）             │          │
│  │  • 修改是永久性的（直到被另一个GE修改）               │          │
│  │                                                       │          │
│  │  示例：                                                │          │
│  │  初始 Health BaseValue = 100                          │          │
│  │  升级 → 应用 Instant GE → BaseValue = 120             │          │
│  │  基础值现在是120了                                  │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  CurrentValue (当前值/有效值)                                       │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  = BaseValue + 所有激活的 Duration GE 的修改之和     │          │
│  │                                                       │          │
│  │  • 由 Duration GE 临时修改（如10秒Buff）              │          │
│  │  • GE到期后自动移除其修改                             │          │
│  │  • 是实际游戏逻辑中使用的值                            │          │
│  │                                                       │          │
│  │  示例：                                                │          │
│  │  BaseValue = 120                                      │          │
│  │                                                       │          │
│  │  应用"生命值+50"Buff (持续时间10s)                      │          │
│  │  CurrentValue = 120 + 50 = 170                        │          │
│  │                                                       │          │
│  │  10秒后 Buff 到期                                      │          │
│  │  CurrentValue = 120 (恢复到BaseValue)                 │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  修改方式的区别：                                                    │
│  ┌───────────────────┬──────────────────┬─────────────────────┐   │
│  │   GE类型          │  修改什么值       │  效果               │   │
│  ├───────────────────┼──────────────────┼─────────────────────┤   │
│  │   Instant         │  BaseValue       │  永久改变           │   │
│  │   Duration        │  CurrentValue    │  临时改变（自动恢复） │   │
│  │   Infinite        │  CurrentValue    │  永久（直到手动移除） │   │
│  │   Periodic        │  CurrentValue    │  与Duration相同     │   │
│  └───────────────────┴──────────────────┴─────────────────────┘   │
│                                                                     │
│  ⚠️ 重要陷阱：如果你想让一个效果"永久"改变属性：                     │
│  ✅ 使用 Instant GE → 修改BaseValue                                │
│  ✅ 使用 Infinite GE + 不手动移除                                   │
│  ❌ 使用 Duration GE → 到期后属性会自动恢复！                       │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 临时修改器(Temporary Modifier) vs 永久修改器

```
┌───────────────────────────────────────────────────────────────────┐
│           属性修改的"临时性"和"永久性"                               │
│                                                                     │
│  修饰类型通过 GE 的 Duration Policy 控制：                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  永久修改 (修改 BaseValue)                                 │    │
│  │  ─────────────────────                                    │    │
│  │  Instant GE → 立即修改BaseValue，不留下GE                  │    │
│  │  用途：升级加点、装备永久属性、技能书学习                    │    │
│  │                                                            │    │
│  │  Infinite GE → 创建持续存在的GE，修改CurrentValue          │    │
│  │  用途：装备附加属性（卸下时移除GE即可）                      │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  临时修改 (修改 CurrentValue)                               │    │
│  │  ─────────────────────                                    │    │
│  │  Duration GE → 有到期时间，到期自动移除                      │    │
│  │  用途：Buff/Debuff、药水效果                               │    │
│  │                                                            │    │
│  │  Periodic GE → Duration GE + 周期触发                      │    │
│  │  用途：中毒、恢复光环                                      │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  属性计算公式：                                                      │
│  CurrentValue = BaseValue + Σ(所有Active Duration/Infinite GE的修改) │
│                                                                     │
│  追踪修改来源：                                                      │
│  GAS 内部用 FActiveGameplayEffectsContainer 管理所有激活的GE       │
│  每个GE对属性的修改都被独立记录                                      │
│  因此可以追踪"我的攻击力200，其中有50来自装备A，30来自Buff B"         │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 属性间的关联

有时属性之间存在关联关系，比如"攻击速度"可能由"敏捷"派生。GAS支持这种属性关联。

```cpp
// ===== 在AttributeSet中设置属性关联 =====
// 这些关联在InitFromMetaData时生效

// 方法1：在AttributeSet的构造函数中使用SetAttributeRelationship
UMyAttributeSet::UMyAttributeSet()
{
    // ... 初始化 ...
}

// 方法2：使用FAttributeMetaData（在蓝图中通过DataTable配置）
// 在蓝图中更方便配置属性关联的元数据
// 属性关联的好处：
// - 次要属性自动随主要属性变化
// - 策划可以在数据表中配置，不用改代码
```

---

## ✅ 正确做法 vs ❌ 错误做法

```cpp
// ===== 属性集的正确和错误做法 =====

// ✅ 正确：在PreAttributeChange中Clamp属性
void UMyAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
    if (Attribute == GetHealthAttribute())
    {
        NewValue = FMath::Clamp(NewValue, 0.0f, GetMaxHealth());
    }
}

// ❌ 错误：在PostGameplayEffectExecute中才Clamp
void UMyAttributeSet::PostGameplayEffectExecute(...)
{
    // ❌ 太晚了！PreAttributeChange就应该Clamp
    // 因为PostGameplayEffectExecute中修改属性可能需要额外处理
    SetHealth(FMath::Clamp(GetHealth(), 0.0f, GetMaxHealth()));
}

// ✅ 正确：在PostGameplayEffectExecute中处理死亡逻辑
void UMyAttributeSet::PostGameplayEffectExecute(...)
{
    if (ModifiedAttribute == GetHealthAttribute())
    {
        if (GetHealth() <= 0.0f)
        {
            // 死亡逻辑放这里
        }
    }
}

// ❌ 错误：在PreAttributeChange中判断死亡
void UMyAttributeSet::PreAttributeChange(...)
{
    if (Attribute == GetHealthAttribute() && NewValue <= 0.0f)
    {
        // ❌ 错误时机！此时GE还没完全生效
        // 可能还有其他恢复生命的GE也会修改这个属性
        Die();  // 不要在这里处理死亡
    }
}

// ✅ 正确：使用DOREPLIFETIME_CONDITION_NOTIFY
void UMyAttributeSet::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION_NOTIFY(UMyAttributeSet, Health, COND_None, REPNOTIFY_Always);
}

// ❌ 错误：忘记写GetLifetimeReplicatedProps
// 属性不会同步到客户端！

// ✅ 正确：OnRep中使用GAMEPLAYATTRIBUTE_REPNOTIFY宏
void UMyAttributeSet::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, OldHealth);
}

// ❌ 错误：OnRep中只记录日志，不调用GAMEPLAYATTRIBUTE_REPNOTIFY
void UMyAttributeSet::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
    // ❌ 没有调用GAMEPLAYATTRIBUTE_REPNOTIFY
    // 导致属性变化的委托不会触发，UI不会更新
    UE_LOG(LogTemp, Log, TEXT("Health Replicated"));
}
```

---

## 完成检查清单

- [ ] 你能写出一个完整的AttributeSet类声明吗（含所有主要属性）？
- [ ] 你理解FGameplayAttributeData的内部结构（BaseValue/CurrentValue）吗？
- [ ] 你知道ATTRIBUTE_ACCESSORS宏自动生成了哪些函数吗？
- [ ] 你理解DOREPLIFETIME_CONDITION_NOTIFY的含义吗？
- [ ] 你知道PreAttributeChange的用途（Clamp）吗？
- [ ] 你知道PostGameplayEffectExecute的用途（死亡处理等）吗？
- [ ] 你能区分Instant GE和Duration GE对BaseValue/CurrentValue的不同影响吗？
- [ ] 你理解GAMEPLAYATTRIBUTE_REPNOTIFY宏的作用吗？
- [ ] 你知道什么时候用COND_OwnerOnly、什么时候用COND_None吗？

---

> **下一节**：[13.7 章节案例](./07-章节案例.md) — 综合实战：构建一个完整的GAS角色框架
