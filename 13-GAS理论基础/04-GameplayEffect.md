# 13.4 GameplayEffect (GE)

> **目标**：全面掌握GE的类型、组成、计算方式和Spec机制。理解GE如何"声明式"地修改属性。
> **难度**：⭐⭐⭐（核心应用级）
> **重要性**：⭐⭐⭐⭐⭐（GE是GAS中"实际做事"的核心）

---

## GameplayEffect是什么——效果配方

```
┌───────────────────────────────────────────────────────────────────┐
│                GameplayEffect (GE) = 效果的"配方"                   │
│                                                                     │
│  GE 不是直接修改属性的代码                                         │
│  GE 是描述"我想怎么修改属性"的数据                                  │
│                                                                     │
│  类比：                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────────┐     │
│  │ 食谱（GE）            │    │ 一份做好的菜（Spec）          │     │
│  │                      │    │                              │     │
│  │ "盐少许，糖一勺，     │    │ 按照食谱，用具体的食材       │     │
│  │  烤30分钟"           │    │ 做出来的一盘菜               │     │
│  │                      │    │                              │     │
│  │  模板/配方            │    │  实例/具体                    │     │
│  └──────────────────────┘    └──────────────────────────────┘     │
│                                                                     │
│  GE 定义了"效果的配方"：                                           │
│  • 修改哪个属性（Health）                                          │
│  • 怎么修改（减少、增加、乘以系数）                                 │
│  • 值怎么计算（固定值、基于属性、自定义计算）                       │
│  • 持续多久（瞬时、持续、无限）                                     │
│  • 什么条件（标签要求）                                             │
│  • 怎么叠（可堆叠）                                                 │
│  • 有什么表现（GameplayCue标签触发特效）                             │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## GE的四种类型

```
┌───────────────────────────────────────────────────────────────────┐
│                    GE 类型完整对比表                                 │
│                                                                     │
├──────────────┬────────────┬────────────┬────────────┬───────────────┤
│    特性      │  Instant   │  Duration  │  Infinite  │   Periodic    │
│              │  (瞬时)    │  (持续)    │  (无限)    │   (周期)      │
├──────────────┼────────────┼────────────┼────────────┼───────────────┤
│ 持续时间     │ 0 (立即)   │ 指定秒数   │ 永久       │ Duration+周期 │
│ 需要手动移除 │ ❌ 不需要  │ ❌ 自动    │ ✅ 需要    │ ❌ 自动       │
│ 修改持续性   │ 永久改变   │ 暂时的     │ 永久(直到  │ 暂时的        │
│              │ BaseValue  │            │ 被移除)    │               │
│ 典型场景     │ 伤害/治疗  │ Buff/Debuff│ 装备属性   │ DOT/HOT       │
│ 有周期       │ ❌         │ ❌         │ ❌         │ ✅            │
│ GameplayCue  │ ✅ 触发一次│ ✅ 持续    │ ✅ 持续    │ ✅ 每次周期   │
├──────────────┼────────────┼────────────┼────────────┼───────────────┤
│                                                                     │
│  各类型工作方式图示：                                                │
│                                                                     │
│  Instant (瞬时)：                                                    │
│    应用GE ──► 修改属性 ──► GE立即消失                                │
│    用途：伤害100点 → Health -= 100                                  │
│    注意：修改的是BaseValue（永久改变）                                │
│                                                                     │
│  Duration (持续)：                                                   │
│    应用GE ──► 修改属性 ──► GE持续10秒 ──► 到期 ──► 属性恢复          │
│    用途：Buff攻击力+20%（持续10秒）                                    │
│    注意：修改的是CurrentValue（临时改变）                             │
│                                                                     │
│  Infinite (无限)：                                                   │
│    应用GE ──► 修改属性 ──► GE一直存在 ──► 手动移除才知道前存在         │
│    用途：装备增加的属性、被动技能                                     │
│    注意：需要ASC::RemoveActiveGameplayEffect来移除                   │
│                                                                     │
│  Periodic (周期)：                                                   │
│    实际上就是Duration + 周期触发                                     │
│    Duration=10s, Period=1s                                          │
│    t=0: 应用GE                                                       │
│    t=1: Execute Periodic Effect → 造成1次伤害                        │
│    t=2: Execute Periodic Effect → 造成1次伤害                        │
│    ...                                                               │
│    t=10: GE到期，移除                                                │
│    用途：中毒（每秒扣血5点，持续10秒）                                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### 类型的代码/C++选择方式

```cpp
// ===== GE类型通常是在蓝图中配置的，但也可以在C++中设置 =====

UCLASS()
class UMyDamageGE : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UMyDamageGE()
    {
        // Duration Policy 决定了GE的类型
        // EGameplayEffectDurationType:
        
        // Instant —— 瞬时效果
        DurationPolicy = EGameplayEffectDurationType::Instant;
        
        // Duration —— 持续效果
        // DurationPolicy = EGameplayEffectDurationType::HasDuration;
        // DurationMagnitude = FScalableFloat(10.0f);  // 持续10秒
        
        // Infinite —— 无限持续
        // DurationPolicy = EGameplayEffectDurationType::Infinite;
        
        // Periodic需要在Duration的基础上，额外设置Period
        // DurationPolicy = EGameplayEffectDurationType::HasDuration;
        // DurationMagnitude = FScalableFloat(10.0f);
        // Period = FScalableFloat(1.0f);  // 每1秒触发一次
    }
};
```

---

## GE的详细组成

```
┌───────────────────────────────────────────────────────────────────┐
│                GameplayEffect 完整结构                                │
│                                                                     │
│  UGameplayEffect                                                   │
│  ├── Duration Policy (持续时间策略)                                  │
│  │   ├── Instant / HasDuration / Infinite                          │
│  │   ├── DurationMagnitude (如果HasDuration: 持续多久)               │
│  │   └── Period (如果周期: 间隔多久)                                 │
│  │                                                                  │
│  ├── Modifiers (修改器数组) ⭐ 核心                                  │
│  │   └── 每个Modifier:                                              │
│  │       ├── Attribute (要修改的属性)                                │
│  │       ├── ModifierOp (操作类型: Add/Multiply/Override/Divide)    │
│  │       ├── Magnitude (修改值大小)                                  │
│  │       │   ├── Scalable Float (固定值)                            │
│  │       │   ├── Attribute Based (基于属性)                         │
│  │       │   ├── Custom Calculation Class (自定义计算MMC)           │
│  │       │   └── Set By Caller (调用时设置)                         │
│  │       ├── SourceTags (来源标签要求)                               │
│  │       └── TargetTags (目标标签要求)                               │
│  │                                                                  │
│  ├── Application Tag Requirements (应用条件)                         │
│  │   ├── RequireTags (目标必须有这些标签)                            │
│  │   └── IgnoreTags (目标不能有这些标签)                             │
│  │                                                                  │
│  ├── Ongoing Tag Requirements (持续条件)                              │
│  │   ├── RequireTags (持续期间目标必须有这些标签)                     │
│  │   └── Remove Tags When Inactive (无这些标签时移除)                 │
│  │                                                                  │
│  ├── Remove Gameplay Effects with Tags (移除效果)                    │
│  │   └── 应用此GE时，移除目标身上哪些标签的效果                        │
│  │                                                                  │
│  ├── Stacking (堆叠规则)                                            │
│  │   ├── StackLimitCount (最大叠层数)                               │
│  │   ├── StackDurationRefreshPolicy (叠层时是否刷新持续时间)          │
│  │   └── StackPeriodResetPolicy (叠层时是否重置周期)                 │
│  │                                                                  │
│  ├── GameplayCues (表现反馈)                                         │
│  │   └── GameplayCueTags (触发哪些GameplayCue)                      │
│  │                                                                  │
│  └── Granted Abilities (授予技能)                                    │
│      └── 应用GE时自动授予目标哪些GA                                   │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## Modifiers —— GE的心脏

Modifier是GE中真正"修改属性"的部分。一个GE可以有多个Modifier。

### 四种Modifier操作

```
┌───────────────────────────────────────────────────────────────────┐
│                  ModifierOp 四种操作                                 │
│                                                                     │
│  假设属性 Health 当前值 = 100                                       │
│                                                                     │
│  ① Add (加法)                                                        │
│     公式: Health = Health + Magnitude                               │
│     示例: Magnitude = 20 → Health = 120 (治疗20点)                   │
│     用途: 固定值治疗、固定值伤害、固定值消耗                         │
│                                                                     │
│  ② Multiply (乘法)                                                  │
│     公式: Health = Health * Magnitude                               │
│     示例: Magnitude = 1.2 → Health = 120 (增加20%)                   │
│     示例: Magnitude = 0.5 → Health = 50 (减少50%)                    │
│     用途: 百分比Buff/Debuff（"增加20%攻击力"）                      │
│                                                                     │
│  ③ Override (覆盖)                                                  │
│     公式: Health = Magnitude                                        │
│     示例: Magnitude = 1 → Health = 1 (锁血)                         │
│     用途: 设置固定值（"无敌状态下生命值强制为1"）                    │
│     ⚠️ 谨慎使用！会忽略所有其他加成                                   │
│                                                                     │
│  ④ Divide (除法)                                                    │
│     公式: Health = Health / Magnitude                               │
│     示例: Magnitude = 2 → Health = 50 (降低到原来的1/2)             │
│     用途: 稀有场景（少用）                                          │
│                                                                     │
│  ⚠️ 重要：多个Modifier的执行顺序                                      │
│  对于同一个属性的Modifier，按GE的应用顺序依次计算                    │
│  同一个GE内的多个Modifier按数组顺序依次计算                          │
│                                                                     │
│  计算顺序示例：                                                      │
│  BaseValue = 100                                                    │
│  GE1 Modifier1: Add 50          → 150                              │
│  GE2 Modifier1: Multiply 1.2    → 180                              │
│  GE3 Modifier1: Override 10     → 10 (覆盖！前面的结果被丢弃！)    │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### Magnitude的四种计算方式

```
┌───────────────────────────────────────────────────────────────────────┐
│            Modifier Magnitude (修改量) 的计算方式                        │
│                                                                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  方式1: Scalable Float (可缩放的浮点数)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  一个简单的数值（可以配等级曲线）                                  │  │
│  │                                                                   │  │
│  │  float Value = 50.0f;  // 基础值                                  │  │
│  │  // 可以通过CurveTable按等级缩放                                   │  │
│  │  // 如：1级=50, 2级=55, 3级=60                                   │  │
│  │                                                                   │  │
│  │  ✅ 最简单，适合不需要计算的固定值                                  │  │
│  │  ✅ 可配曲线表做等级增长                                           │  │
│  │  ❌ 不能根据角色状态动态计算                                        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  方式2: Attribute Based (基于属性计算)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  从来源或目标的属性值派生                                           │  │
│  │                                                                   │  │
│  │  计算: (SourceAttr * Coefficient + PreAdd) * PostMultiply         │  │
│  │                                                                   │  │
│  │  示例1: 伤害 = 攻击力 * 1.5 + 0                                    │  │
│  │    SourceAttribute  = AttackPower                                 │  │
│  │    Coefficient      = 1.5                                        │  │
│  │    → 如果攻击力=100，则伤害=150                                    │  │
│  │                                                                   │  │
│  │  示例2: 治疗 = 施法者法力上限 * 0.3                                │  │
│  │    SourceAttribute  = MaxMana                                    │  │
│  │    Coefficient      = 0.3                                        │  │
│  │    → 如果法力上限=200，则治疗量=60                                 │  │
│  │                                                                   │  │
│  │  ✅ 适合"攻击力决定伤害"这种动态计算                                │  │
│  │  ✅ 策划可以调整系数                                               │  │
│  │  ❌ 复杂的非线性计算需要MMC                                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  方式3: Custom Calculation Class (MMC)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  自定义C++类，实现任意复杂的计算逻辑                                │  │
│  │                                                                   │  │
│  │  class UMMC_FireballDamage : public UGameplayModMagnitudeCalculation│
│  │  {                                                                │  │
│  │      // 可以捕获任意数量的属性值                                    │  │
│  │      // 可以实现任意复杂的计算公式                                  │  │
│  │      // 如：伤害 = (攻击力 * 1.5 - 防御力 * 0.5) * 暴击系数        │  │
│  │      //       * 元素克制系数 * 距离衰减系数                        │  │
│  │  };                                                               │  │
│  │                                                                   │  │
│  │  ✅ 最灵活，可以实现任意复杂计算                                    │  │
│  │  ✅ 可重用（同一个MMC可以被多个GE使用）                             │  │
│  │  ⚠️ 需要写C++代码                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  方式4: Set By Caller (调用者设置)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  运行时由代码动态设置值                                             │  │
│  │                                                                   │  │
│  │  // 创建Spec时设置：                                               │  │
│  │  SpecHandle.Data->SetSetByCallerMagnitude(                        │  │
│  │      FGameplayTag::RequestGameplayTag(FName("Data.Damage")),     │  │
│  │      45.0f  // 动态伤害值                                         │  │
│  │  );                                                               │  │
│  │                                                                   │  │
│  │  ✅ 适合运行时决定的数值（如随机伤害范围）                          │  │
│  │  ✅ 配合AttributeBased可以实现"攻击力 * 随机系数"                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└───────────────────────────────────────────────────────────────────────┘
```

### MMC示例 —— 自定义计算类

```cpp
// ===== MMC_DamageCalculation.h =====
#pragma once

#include "CoreMinimal.h"
#include "GameplayModMagnitudeCalculation.h"
#include "MMC_DamageCalculation.generated.h"

/**
 * 伤害计算 MMC
 * 
 * 公式: 伤害 = (攻击力 * 技能系数 - 目标防御力 * 0.5) * 暴击系数 * 元素克制系数
 * 
 * 捕获的属性:
 * - 来源的攻击力 (AttackPower)
 * - 目标的防御力 (Defense)
 * - 来源的暴击率 (CriticalChance)
 * - 来源的暴击伤害 (CriticalDamage)
 */
UCLASS()
class MYGAME_API UMMC_DamageCalculation : public UGameplayModMagnitudeCalculation
{
    GENERATED_BODY()

public:
    UMMC_DamageCalculation();

    // ===== 核心计算函数 =====
    virtual float CalculateBaseMagnitude_Implementation(
        const FGameplayEffectSpec& Spec  // GE的实例
    ) const override;

private:
    // 捕获的属性定义 —— 声明这个MMC需要哪些属性值
    FGameplayEffectAttributeCaptureDefinition AttackPowerDef;
    FGameplayEffectAttributeCaptureDefinition DefenseDef;
    FGameplayEffectAttributeCaptureDefinition CriticalChanceDef;
    FGameplayEffectAttributeCaptureDefinition CriticalDamageDef;
};
```

```cpp
// ===== MMC_DamageCalculation.cpp =====
#include "MMC_DamageCalculation.h"
#include "MyAttributeSet.h"  // 你的属性集

UMMC_DamageCalculation::UMMC_DamageCalculation()
{
    // 定义需要从来源捕获的属性
    AttackPowerDef.AttributeToCapture = UMyAttributeSet::GetAttackPowerAttribute();
    AttackPowerDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Source;  // 来源（施法者）
    AttackPowerDef.bSnapshot = false;  // 不拍快照，实时获取

    CriticalChanceDef.AttributeToCapture = UMyAttributeSet::GetCriticalChanceAttribute();
    CriticalChanceDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Source;
    CriticalChanceDef.bSnapshot = false;

    CriticalDamageDef.AttributeToCapture = UMyAttributeSet::GetCriticalDamageAttribute();
    CriticalDamageDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Source;
    CriticalDamageDef.bSnapshot = false;

    // 定义需要从目标捕获的属性
    DefenseDef.AttributeToCapture = UMyAttributeSet::GetDefenseAttribute();
    DefenseDef.AttributeSource = EGameplayEffectAttributeCaptureSource::Target;  // 目标
    DefenseDef.bSnapshot = false;

    // 将捕获定义注册到数组
    RelevantAttributesToCapture.Add(AttackPowerDef);
    RelevantAttributesToCapture.Add(DefenseDef);
    RelevantAttributesToCapture.Add(CriticalChanceDef);
    RelevantAttributesToCapture.Add(CriticalDamageDef);
}

float UMMC_DamageCalculation::CalculateBaseMagnitude_Implementation(
    const FGameplayEffectSpec& Spec) const
{
    // ===== 步骤1：获取捕获的属性值 =====
    
    // 尝试获取来源的攻击力
    float AttackPower = 0.0f;
    GetCapturedAttributeMagnitude(
        AttackPowerDef,     // 要获取的属性
        Spec,               // GE Spec
        FAggregatorEvaluateParameters(),  // 评估参数
        AttackPower         // 输出：属性值
    );

    // 获取目标的防御力
    float Defense = 0.0f;
    GetCapturedAttributeMagnitude(DefenseDef, Spec, 
        FAggregatorEvaluateParameters(), Defense);

    // 获取暴击率和暴击伤害
    float CriticalChance = 0.0f;
    GetCapturedAttributeMagnitude(CriticalChanceDef, Spec, 
        FAggregatorEvaluateParameters(), CriticalChance);

    float CriticalDamage = 1.5f;  // 默认暴击伤害150%
    GetCapturedAttributeMagnitude(CriticalDamageDef, Spec, 
        FAggregatorEvaluateParameters(), CriticalDamage);

    // ===== 步骤2：获取SetByCaller值（技能系数）=====
    // 这个值在创建Spec时由技能代码设置
    float SkillCoefficient = Spec.GetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("Data.SkillCoeff")),
        false,  // 如果没有设置，不警告
        1.0f    // 默认值
    );

    // ===== 步骤3：执行计算公式 =====
    
    // 基础伤害 = 攻击力 * 技能系数 - 防御力 * 0.5
    float BaseDamage = (AttackPower * SkillCoefficient) - (Defense * 0.5f);
    
    // 伤害不能为负数
    BaseDamage = FMath::Max(BaseDamage, 1.0f);  // 至少造成1点伤害
    
    // 判定暴击
    bool bIsCritical = (FMath::FRand() < CriticalChance);  // 随机判定
    if (bIsCritical)
    {
        BaseDamage *= CriticalDamage;  // 乘以暴击伤害倍率
    }

    // ===== 步骤4：输出日志（调试用）=====
    UE_LOG(LogTemp, Log, 
        TEXT("MMC Damage Calc: Atk=%.1f Def=%.1f Coeff=%.2f Crit=%s → Damage=%.1f"),
        AttackPower, Defense, SkillCoefficient,
        bIsCritical ? TEXT("YES") : TEXT("NO"),
        BaseDamage
    );

    return BaseDamage;
}
```

---

## GE的应用条件 —— Application Tag Requirements

```
┌───────────────────────────────────────────────────────────────────┐
│            Application Tag Requirements —— 谁能受此效果             │
│                                                                     │
│  应用一个GE到目标时，GAS先检查：                                    │
│  ☑ 目标有必需的标签吗？(RequireTags)                                │
│  ☑ 目标没有忽略的标签吗？(IgnoreTags)                               │
│                                                                     │
│  只有两个条件都满足，GE才能生效                                      │
│                                                                     │
│  使用场景：                                                          │
│                                                                     │
│  场景1：对"亡灵"类型敌人造成额外伤害                                 │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  RequireTags: Enemy.Type.Undead                     │          │
│  │  只有目标是"亡灵"时，这个GE才生效                    │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  场景2：无敌状态下不受伤害                                          │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  IgnoreTags: State.Combat.Invincible                │          │
│  │  目标有无敌标签时，这个伤害GE不生效                  │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  场景3：只能对玩家释放的技能                                        │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  RequireTags: Type.Player                           │          │
│  │  IgnoreTags: State.Dead                             │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  注意：RequireTags和IgnoreTags是"与"逻辑                            │
│  目标必须有所有RequireTags 且 没有任何IgnoreTags                     │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 持续效果条件 —— Ongoing Tag Requirements

```
┌───────────────────────────────────────────────────────────────────┐
│        Ongoing Tag Requirements —— 持续期间的标签条件               │
│                                                                     │
│  仅在 Duration/Infinite 类型的 GE 上有效                            │
│                                                                     │
│  作用机制：                                                          │
│  每个周期（或每帧）、GAS检查：                                       │
│  ☑ 持续条件还满足吗？                                               │
│  ├─ 满足 → 继续 (GE保持激活)                                        │
│  └─ 不满足 → 暂停或移除GE                                           │
│                                                                     │
│  使用场景：                                                          │
│                                                                     │
│  场景：只有在战斗状态才会持续的Buff                                  │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  RequireTags: State.Combat.InCombat                 │          │
│  │  → Buff只在战斗中有效，脱战后自动移除                │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  场景：只能在暗处使用的隐身                                         │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  RequireTags: Environment.Dark                      │          │
│  │  → 走到亮处后隐身自动消失                            │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 堆叠规则 (Stacking)

```
┌───────────────────────────────────────────────────────────────────┐
│                    GE 堆叠规则详解                                   │
│                                                                     │
│  场景：角色被两次施放同一个"攻击力提升"Buff                           │
│                                                                     │
│  什么样的行为才合理？需要根据设计决定：                               │
│                                                                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  选项1：不堆叠 (StackLimitCount = 1)                                │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  同一来源的同一个GE只能存在一个实例                   │          │
│  │  第二次施放时：刷新持续时间（而不是叠加两层）          │          │
│  │                                                       │          │
│  │  第一次: 攻击力+20% (持续10s)                         │          │
│  │  第二次(第3s): 攻击力+20% (持续时间重置为10s)         │          │
│  │  → 效果不叠加，但持续时间刷新                          │          │
│  │                                                       │          │
│  │  适合：同名Buff不叠加的游戏                            │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  选项2：按层数堆叠 (StackLimitCount = 3)                            │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  同一GE最多堆叠N层                                    │          │
│  │                                                       │          │
│  │  第一次: 攻击力+20% (层数1)                            │          │
│  │  第二次: 攻击力+40% (层数2)                            │          │
│  │  第三次: 攻击力+60% (层数3)                            │          │
│  │  第四次: 不生效（已达上限）                             │          │
│  │                                                       │          │
│  │  适合：可叠加的Buff/Debuff                             │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  选项3：无限制堆叠                                                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  StackLimitCount = 0 表示无上限                       │          │
│  │  每次施放都是独立的一层                                │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  堆叠类型（StackingType）：                                         │
│                                                                     │
│  AggregateByTarget (按目标聚合) —— 默认                             │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  不管是谁施放的，只要同一个GE应用在同一个目标上       │          │
│  │  就计入堆叠                                            │          │
│  │                                                       │          │
│  │  玩家A造成 中毒(3层)  +  玩家B造成 中毒(2层)           │          │
│  │  = 目标身上中毒总层数: 5层                            │          │
│  │                                                       │          │
│  │  适合：中毒、流血等通用Debuff                          │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  AggregateBySource (按来源聚合)                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  每个来源独立计数                                      │          │
│  │                                                       │          │
│  │  玩家A造成 中毒(3层/3上限) → 满了，A不能再叠           │          │
│  │  玩家B造成 中毒(2层/3上限) → B还可以再叠1层            │          │
│  │                                                       │          │
│  │  目标总层数 = 5，但来自A=3, 来自B=2                   │          │
│  │                                                       │          │
│  │  适合：按来源独立限制的场景（防止一个人无限叠）          │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## GameplayEffectSpec —— 效果实例

GE是模板，Spec是实例。这是"食谱"和"做好的菜"的区别。

```
┌───────────────────────────────────────────────────────────────────┐
│            GE (模板) vs Spec (实例)                                  │
│                                                                     │
│  UGameplayEffect (CDO/资产)      FGameplayEffectSpec               │
│  ┌─────────────────────┐        ┌─────────────────────────┐      │
│  │ 静态的"配方"         │        │ 动态的"实例"             │      │
│  │                     │        │                         │      │
│  │ 伤害 = 基于攻击力    │  ──▶  │ 伤害 = 攻击力150 * 1.5  │      │
│  │                     │        │       = 225 (已计算)    │      │
│  │ 持续 = 10秒          │        │ 持续 = 10秒 (还剩7.3s) │      │
│  │                     │        │                         │      │
│  │ 所有参数是模板       │        │ 所有参数是具体值          │      │
│  └─────────────────────┘        │ 包含Instigator/Level等  │      │
│                                 └─────────────────────────┘      │
│                                                                     │
│  创建Spec的流程：                                                    │
│                                                                     │
│  1. MakeOutgoingSpec(GE类, Level, Context)                          │
│       └→ 基于GE模板创建Spec，填充Context(Instigator等)               │
│                                                                     │
│  2. 可选：设置SetByCaller Magnitude                                 │
│       └→ Spec.Data->SetSetByCallerMagnitude(Tag, Value)            │
│                                                                     │
│  3. 可选：设置DynamicAssetTags（动态添加标签的GE）                     │
│       └→ Spec.Data->DynamicAssetTags.AddTag(Tag)                    │
│                                                                     │
│  4. 应用Spec                                                        │
│       └→ ASC->ApplyGameplayEffectSpecToSelf(Spec)                  │
│       └→ ASC->ApplyGameplayEffectSpecToTarget(Spec, TargetASC)    │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### Spec的完整代码示例

```cpp
// ===== 创建并应用带动态参数的GE Spec =====

void ApplyDamage(
    UAbilitySystemComponent* SourceASC,     // 施法者的ASC
    UAbilitySystemComponent* TargetASC,     // 目标的ASC
    TSubclassOf<UGameplayEffect> DamageGE,  // 伤害GE模板
    float SkillCoefficient,                  // 技能系数（动态）
    float BonusDamage                        // 额外伤害（如连击加成）
)
{
    if (!SourceASC || !TargetASC || !DamageGE)
    {
        return;
    }

    // ===== 步骤1：创建EffectContext（上下文）=====
    // EffectContext 包含了：
    // - Instigator (谁造成这个效果)
    // - EffectCauser (用哪个Actor造成效果)
    // - HitResult (如果是从碰撞触发的)
    // - Origin (效果来源位置)
    FGameplayEffectContextHandle EffectContext = SourceASC->MakeEffectContext();
    
    // 可以添加额外信息到上下文
    // EffectContext.AddHitResult(HitResult);     // 如果从碰撞来
    // EffectContext.AddOrigin(ProjectileLocation); // 伤害来源位置

    // ===== 步骤2：创建Spec =====
    // Spec = GE模板 + 动态参数
    FGameplayEffectSpecHandle SpecHandle = SourceASC->MakeOutgoingSpec(
        DamageGE,         // 基础GE模板
        1,                // 技能等级（影响Scalable Float的曲线取值）
        EffectContext     // 上下文
    );

    if (!SpecHandle.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to create Damage Spec!"));
        return;
    }

    // ===== 步骤3：设置SetByCaller值 =====
    // 这些值会被GE的Modifier中的SetByCaller Magnitude读取
    
    // 设置技能系数（会在MMC中读到）
    SpecHandle.Data->SetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("Data.SkillCoeff")),
        SkillCoefficient
    );

    // 设置额外伤害加成
    SpecHandle.Data->SetSetByCallerMagnitude(
        FGameplayTag::RequestGameplayTag(FName("Data.BonusDamage")),
        BonusDamage
    );

    // ===== 步骤4：设置动态标签（可选）=====
    // 可以给这个Spec动态添加标签
    // 这些标签会被包含在Spec中，但不影响GE模板本身
    
    // 标记这个伤害是暴击
    // SpecHandle.Data->DynamicAssetTags.AddTag(
    //     FGameplayTag::RequestGameplayTag(FName("Damage.Critical"))
    // );

    // ===== 步骤5：应用Spec到目标 =====
    // ApplyGameplayEffectSpecToTarget 会：
    // 1. 检查 Application Tag Requirements
    // 2. 计算所有Modifier（包括调用MMC）
    // 3. 修改目标属性
    // 4. 触发GameplayCue
    // 5. 触发PostGameplayEffectExecute回调
    SourceASC->ApplyGameplayEffectSpecToTarget(
        *SpecHandle.Data.Get(),  // 解引用FGameplayEffectSpecHandle得到Spec
        TargetASC                // 目标的ASC
    );

    // 打印日志
    UE_LOG(LogTemp, Log, TEXT("Applied damage: SkillCoeff=%.2f Bonus=%.1f"),
        SkillCoefficient, BonusDamage);
}
```

---

## ✅ 正确做法 vs ❌ 错误做法

```cpp
// ===== GE使用的正确和错误方式 =====

// ✅ 正确：通过GE修改属性
void ApplyDamage(AActor* Target, float Damage)
{
    UAbilitySystemComponent* TargetASC = GetASC(Target);
    if (!TargetASC) return;

    FGameplayEffectSpecHandle Spec = MakeDamageSpec(Damage);
    SourceASC->ApplyGameplayEffectSpecToTarget(*Spec.Data.Get(), TargetASC);
}

// ❌ 错误：直接修改属性
void ApplyDamage_Wrong(AActor* Target, float Damage)
{
    // 直接修改AttributeSet的属性
    // 问题1: 绕过了GAS的标签检查
    // 问题2: 不会触发PostGameplayEffectExecute
    // 问题3: 不会触发GameplayCue
    // 问题4: 网络同步出问题
    // 问题5: 其他系统不知道属性被改了
    UMyAttributeSet* AS = GetAttributeSet(Target);
    if (AS) AS->SetHealth(AS->GetHealth() - Damage);
}

// ✅ 正确：使用AttributeBased计算伤害
// 在GE蓝图中配置：
// Modifier: Health (Target)
// Operator: Add
// Magnitude: Attribute Based
//   - Attribute: AttackPower (Source)
//   - Coefficient: -1.5
//   - 结果 = 攻击力 * -1.5 = 减少生命值

// ❌ 错误：把复杂的伤害公式写在技能Actor的代码里
void AFireball::OnHit(AActor* Target)
{
    // 所有计算都写在代码里，策划无法调整
    float Atk = GetOwnerAttack();
    float Def = Target->GetDefense();
    float Crit = Random() < 0.3 ? 2.0 : 1.0;
    float Damage = (Atk * 1.5 - Def * 0.5) * Crit;
    Target->TakeDamage(Damage);
}

// ✅ 正确：使用MMC封装伤害公式
// 伤害公式放在MMC_DamageCalculation中
// 策划可以调整系数（通过曲线表或SetByCaller）
// 多个技能可以复用同一个MMC
```

---

## GE的快照(Snapshot)机制

```
┌───────────────────────────────────────────────────────────────────┐
│                GE Snapshot —— "快照" vs "实时"                       │
│                                                                     │
│  当Modifier使用Attribute Based计算时：                              │
│                                                                     │
│  bSnapshot = true (快照模式)                                         │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  在GE应用时，获取属性的值并锁定                        │          │
│  │  即使后续来源的属性变化，伤害值不变                     │          │
│  │                                                       │          │
│  │  示例：火球发射时 AttackPower = 100                   │          │
│  │        飞行0.5秒后命中目标                            │          │
│  │        飞行期间来源攻击力提升了 → 但伤害还是基于100计算  │          │
│  │                                                       │          │
│  │  适合：投射物技能（伤害在发射时就决定了）              │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  bSnapshot = false (实时模式，默认)                                  │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  在GE实际执行计算时，获取属性的当前值                  │          │
│  │                                                       │          │
│  │  示例：持续伤害区域（毒雾）                             │          │
│  │        每周期伤害基于施展者当前的攻击力计算             │          │
│  │        如果施展者攻击力变化，伤害也跟着变              │          │
│  │                                                       │          │
│  │  适合：DOT、光环等持续效果                            │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## GE授予技能 (Granted Abilities)

GE不仅能修改属性，还能授予技能：

```
┌───────────────────────────────────────────────────────────────────┐
│                Granted Abilities —— GE授予技能                       │
│                                                                     │
│  GE配置中可以添加"授予的技能"列表                                   │
│  当GE应用到目标时，自动将指定的GA授予目标                            │
│  当GE移除时，自动回收这些GA                                         │
│                                                                     │
│  使用场景：                                                          │
│                                                                     │
│  场景1：装备系统                                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  装备"火焰之剑"时应用一个Infinite GE                  │          │
│  │  这个GE不仅增加攻击力，还授予"火焰斩"技能            │          │
│  │  卸下装备时GE被移除，技能也自动移除                   │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  场景2：状态变化                                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  角色进入"狂暴"状态（GE持续15秒）                     │          │
│  │  这个GE授予特殊攻击技能（仅在狂暴期间可用）           │          │
│  │  15秒后GE到期，特殊技能自动移除                       │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  场景3：被动技能                                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  天赋系统的被动技能用Infinite GE实现                  │          │
│  │  每个天赋是一个GE，授予相应的能力                     │          │
│  │  洗点时移除GE即可                                     │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 完成检查清单

- [ ] 你能说出GE的四种类型（Instant/Duration/Infinite/Periodic）及其区别吗？
- [ ] 你理解Modifier的四种操作（Add/Multiply/Override/Divide）吗？
- [ ] 你能区分Magnitude的四种计算方式（ScalableFloat/AttributeBased/MMC/SetByCaller）吗？
- [ ] 你能写出一个MMC自定义计算类的完整代码吗？
- [ ] 你理解GE模板和Spec实例的区别吗？
- [ ] 你知道如何创建Spec并设置SetByCaller值吗？
- [ ] 你理解Application Tag Requirements的作用吗？
- [ ] 你理解堆叠规则（Stacking）的两种类型（AggregateByTarget/BySource）吗？
- [ ] 你知道Snapshot快照模式和实时模式的区别吗？
- [ ] 你理解GE如何授予技能吗？

---

> **下一节**：[13.5 GameplayTag](./05-GameplayTag.md) — 层级标签系统详解
