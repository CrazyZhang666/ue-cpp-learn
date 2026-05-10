# 13.3 GameplayAbility (GA)

> **目标**：全面掌握技能类GameplayAbility的创建、生命周期、标签配置和实例化策略。
> **难度**：⭐⭐⭐（核心应用级）
> **重要性**：⭐⭐⭐⭐⭐（这是写技能的核心类）

---

## GameplayAbility是什么

```
┌─────────────────────────────────────────────────────────────────┐
│            GameplayAbility (GA) —— 技能的"蓝图"                  │
│                                                                  │
│  每个GA代表一个独立的技能：                                       │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ GA_Fireball │  │  GA_Heal    │  │  GA_Dash    │             │
│  │  火球术     │  │  治疗术     │  │  冲刺       │             │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤             │
│  │ 冷却: 3s    │  │ 冷却: 8s    │  │ 冷却: 1.5s  │             │
│  │ 消耗: 20蓝  │  │ 消耗: 30蓝  │  │ 消耗: 10体  │             │
│  │ 伤害: 50    │  │ 治疗: 40    │  │ 距离: 6m    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  GA 和 GE 的关系：                                              │
│  ┌─────────────────────────────────────────┐                   │
│  │  GA = 驾驶员（决策者）                    │                   │
│  │  GE = 汽车（执行工具）                    │                   │
│  │                                         │                   │
│  │  GA 决定：何时释放技能、检查路径是否有效   │                   │
│  │  GE 执行：实际造成伤害、扣除法力、加Buff   │                   │
│  │                                         │                   │
│  │  一个GA可以应用多个GE（技能消耗GE +        │                   │
│  │  冷却GE + 伤害GE + 特效GE）              │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## GA的生命周期

理解GA的生命周期是关键。每个GA从"被给予"到"执行完毕"，经历以下阶段：

```
                    GA 完整生命周期

      ┌──────────────────┐
      │  1. Give (给予)   │  ← ASC::GiveAbility()
      │  技能被添加到     │    技能现在"可用"，但还没有激活
      │  ASC的技能列表    │
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │  2. CanActivate   │  ← 每帧或每次尝试激活时检查
      │  检查激活条件     │    - 标签条件是否满足？
      │                  │    - 冷却是否完毕？
      │                  │    - 消耗是否足够？
      └────────┬─────────┘
               │        ❌ 条件不满足 → 激活失败，返回false
               │
               ▼        ✅ 条件满足
      ┌──────────────────┐
      │  3. Activate      │  ← TryActivateAbility() 成功后调用
      │  技能开始执行     │    ActivateAbility() 被调用
      │                  │    - 添加技能状态标签
      │                  │    - 播放技能动画
      │                  │    - 启动逻辑流程
      └────────┬─────────┘
               │
          ┌────┴────┐
          ▼         ▼
   ┌──────────┐ ┌──────────┐
   │ 4a. Commit│ │ 4b. Cancel│
   │ 提交技能  │ │ 取消技能  │
   │ - 扣消耗  │ │ - 被打断   │
   │ - 启冷却  │ │ - 自己取消 │
   │ - 应用伤害│ │ - 条件不满足│
   └────┬─────┘ └────┬─────┘
        │            │
        ▼            ▼
   ┌──────────┐ ┌──────────┐
   │ 5a. End   │ │ 5b. End  │
   │ 正常结束  │ │ 非正常结束│
   └──────────┘ └──────────┘
        两者都调用 EndAbility()
        - 清理状态标签
        - 清理临时资源
        - 通知ASC技能已结束
```

---

## 创建一个GA类——代码骨架

```cpp
// ===== MyFireballAbility.h =====
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "MyFireballAbility.generated.h"

/**
 * UMyFireballAbility - 火球术技能
 * 
 * 继承自 UGameplayAbility，这是所有技能的基类
 */
UCLASS()
class MYGAME_API UMyFireballAbility : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UMyFireballAbility();

    // ===== 核心覆写函数 =====

    // 技能激活时调用 —— 你的技能逻辑入口
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,           // 技能句柄
        const FGameplayAbilityActorInfo* ActorInfo,        // 角色信息
        const FGameplayAbilityActivationInfo ActivationInfo, // 激活信息
        const FGameplayEventData* TriggerEventData         // 触发事件数据
    ) override;

    // 技能结束时调用 —— 清理工作
    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,    // 是否需要同步结束
        bool bWasCancelled            // 是否被取消
    ) override;

    // 检查消耗是否足够（可选覆写）
    virtual bool CheckCost(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        FGameplayTagContainer* OptionalRelevantTags  // 输出：不满足的标签
    ) const override;

    // 应用消耗（Commit阶段调用）
    virtual void ApplyCost(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo
    ) const override;

protected:
    // ===== 技能配置（在蓝图或构造函数中设置）=====

    // 技能释放的动画蒙太奇
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Animation")
    class UAnimMontage* CastingMontage;

    // 要生成的投射物类
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Projectile")
    TSubclassOf<class AMyProjectile> ProjectileClass;

    // 技能的伤害GE
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Effect")
    TSubclassOf<class UGameplayEffect> DamageEffectClass;

    // ===== 私有辅助函数 =====
private:
    // 生成火球投射物
    void SpawnFireball();

    // 蒙太奇播放完成的回调
    UFUNCTION()
    void OnMontageCompleted();
    
    // 蒙太奇被中断的回调
    UFUNCTION()
    void OnMontageCancelled();
};
```

```cpp
// ===== MyFireballAbility.cpp =====
#include "MyFireballAbility.h"
#include "AbilitySystemComponent.h"
#include "Abilities/GameplayAbilityTypes.h"
#include "GameplayEffect.h"

UMyFireballAbility::UMyFireballAbility()
{
    // 构造时设置默认配置

    // 技能实例化策略：每个角色独立实例（后面详讲）
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;

    // 网络执行策略：仅在服务器执行
    // （服务器权威 —— 客户端请求，服务器执行）
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerOnly;

    // 激活时阻止的标签 —— 有这些标签时无法激活
    ActivationBlockedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.Dead"))
    );
    ActivationBlockedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.CC.Stun"))
    );
    ActivationBlockedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.CC.Silence"))
    );

    // 激活时必需的标签 —— 必须有这些标签才能激活
    // （火球术一般不需要特定标签才能释放）
    // ActivationRequiredTags.AddTag(...);

    // 激活时自动添加的标签 —— 用于标记"正在施法"
    ActivationOwnedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.Combat.Casting"))
    );
    ActivationOwnedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.Combat.Attacking"))
    );

    // 这个技能拥有的标签 —— 用于其他技能的取消/阻止
    AbilityTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("Ability.Type.Skill"))
    );
    AbilityTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("Ability.Element.Fire"))
    );

    // 激活时取消哪些标签的技能
    // （火球术一般不打断其他技能，所以不配置）
    // CancelAbilitiesWithTag.AddTag(...);

    // 激活时被哪些标签阻塞
    // （不配置，用ActivationBlockedTags来限制）
    // BlockAbilitiesWithTag.AddTag(...);
}

void UMyFireballAbility::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    // ===== 步骤1：检查必要条件 =====
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        // CommitAbility 内部调用 CheckCost 和 CheckCooldown
        // 如果消耗不足或冷却中，返回false
        // 此时应该结束技能
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }
    // CommitAbility 成功后：
    // ✅ ApplyCost 已被调用（法力已扣除）
    // ✅ ApplyCooldown 已被调用（冷却GE已应用）
    // ✅ ActivationOwnedTags 已自动添加到ASC

    // ===== 步骤2：获取必要的引用 =====
    // 获取角色的ASC
    UAbilitySystemComponent* ASC = ActorInfo->AbilitySystemComponent.Get();
    
    // 获取Avatar（物理角色）
    AActor* Avatar = ActorInfo->AvatarActor.Get();
    
    // 获取Character（如果是玩家/NPC）
    ACharacter* Character = Cast<ACharacter>(Avatar);

    // ===== 步骤3：播放技能动画 =====
    if (Character && CastingMontage)
    {
        // 通过ASC播放蒙太奇（这样中断逻辑能正确工作）
        FGameplayAbilityPlayMontageInfo MontageInfo;
        MontageInfo.AnimMontage = CastingMontage;

        // 这个函数会：
        // 1. 在Avatar上播放蒙太奇
        // 2. 如果蒙太奇中断，自动处理技能取消
        // 3. 如果NetExecutionPolicy是ServerOnly，自动同步
        ASC->AbilityPlayMontage(this, MontageInfo);
    }

    // ===== 步骤4：执行技能核心逻辑 =====
    SpawnFireball();

    // ===== 步骤5：结束技能 =====
    // 对于即时技能（如发射火球），执行完就结束
    // 对于持续技能（如蓄力、引导），等待条件满足再结束
    EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
}

void UMyFireballAbility::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    // ===== 清理工作 =====
    
    // 停止技能动画
    if (ActorInfo && ActorInfo->AbilitySystemComponent.IsValid())
    {
        ActorInfo->AbilitySystemComponent->AbilityStopMontage(this);
    }

    // ⚠️ 注意：ActivationOwnedTags 会自动被移除
    // 不需要手动 RemoveLooseGameplayTag(State.Combat.Casting)

    // 调用基类（必须！基类会处理很多清理工作）
    Super::EndAbility(Handle, ActorInfo, ActivationInfo, 
                      bReplicateEndAbility, bWasCancelled);
}

bool UMyFireballAbility::CheckCost(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    FGameplayTagContainer* OptionalRelevantTags) const
{
    // 默认的CheckCost会检查CostGE是否能够应用
    // 如果需要自定义消耗检查（如"生命值转法力"），覆写这个函数
    return Super::CheckCost(Handle, ActorInfo, OptionalRelevantTags);
}

void UMyFireballAbility::ApplyCost(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo) const
{
    // 默认的ApplyCost会应用CostGE
    // 如果想自定义消耗逻辑（如消耗经验值释放技能），覆写这个函数
    Super::ApplyCost(Handle, ActorInfo, ActivationInfo);
}

void UMyFireballAbility::SpawnFireball()
{
    // 获取角色信息
    const FGameplayAbilityActorInfo* ActorInfo = GetActorInfo();
    if (!ActorInfo || !ActorInfo->AvatarActor.IsValid())
    {
        return;
    }

    AActor* Avatar = ActorInfo->AvatarActor.Get();
    UWorld* World = Avatar->GetWorld();
    if (!World || !ProjectileClass)
    {
        return;
    }

    // 计算生成位置（角色前方一定距离）
    FVector SpawnLocation = Avatar->GetActorLocation() + 
                            Avatar->GetActorForwardVector() * 100.0f;
    FRotator SpawnRotation = Avatar->GetActorRotation();

    // 生成参数
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = Avatar;                          // 设置所有者
    SpawnParams.Instigator = Avatar;                     // 设置触发者（用于击杀统计等）
    SpawnParams.SpawnCollisionHandlingOverride = 
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn; // 忽略碰撞检测直接生成

    // 生成投射物
    AMyProjectile* Projectile = World->SpawnActor<AMyProjectile>(
        ProjectileClass,
        SpawnLocation,
        SpawnRotation,
        SpawnParams
    );

    if (Projectile)
    {
        // 把伤害GE类传递给投射物，碰撞时使用
        Projectile->SetDamageEffectClass(DamageEffectClass);
        
        // 设置投射物的ASC（用于后续应用伤害GE）
        Projectile->SetOwnerAbilitySystemComponent(
            ActorInfo->AbilitySystemComponent.Get()
        );
    }
}
```

---

## 技能标签——六种标签配置详解

这是GA中使用GameplayTag最多的部分。理解每种标签的作用对于设计技能系统至关重要。

```
┌───────────────────────────────────────────────────────────────────┐
│                 GA 的六种标签配置                                    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ① Ability Tags                                           │    │
│  │  "这个技能是什么标签"                                       │    │
│  │  用于被其他技能识别                                         │    │
│  │  例：火球术有 Ability.Element.Fire 标签                     │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ② Cancel Abilities with Tags                             │    │
│  │  "激活这个技能时，取消所有带有这些标签的技能"                 │    │
│  │  例：冲刺(Dash)激活时，打断所有 Ability.Type.Channel 技能     │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ③ Block Abilities with Tags                              │    │
│  │  "激活期间，阻止所有带有这些标签的技能的激活"                 │    │
│  │  例：引导技能期间，阻止所有其他 Ability.Type.Skill            │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ④ Activation Owned Tags                                  │    │
│  │  "激活时，临时给ASC加上这些标签"                             │    │
│  │  例：释放火球时加 State.Combat.Casting 标签                 │    │
│  │  技能结束时自动移除                                         │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ⑤ Activation Required Tags                               │    │
│  │  "必须有这些标签才能激活"                                   │    │
│  │  例：狂暴技能需要 State.Combat.InCombat 标签                 │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  ⑥ Activation Blocked Tags                                │    │
│  │  "有这些标签时不能激活"                                     │    │
│  │  例：有 State.Dead 或 State.CC.Stun 时不能放火球           │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### 标签使用示例——完整的技能系统设计

```cpp
// ===== 技能标签系统设计示例 =====

// 首先定义项目级的标签体系
// （在DefaultGameplayTags.ini或编辑器中定义）

// 技能类型标签
Ability.Type.Active          // 主动技能（玩家按键释放）
Ability.Type.Passive         // 被动技能（自动生效）
Ability.Type.Channel         // 引导技能（需要持续施法）
Ability.Type.Movement        // 移动技能（冲刺、闪现）

// 技能元素标签
Ability.Element.Fire         // 火系
Ability.Element.Water        // 水系
Ability.Element.Thunder      // 雷系
Ability.Element.Ice          // 冰系

// 角色状态标签
State.Dead                   // 死亡
State.CC                     // 所有控制效果（Crowd Control）的父级
State.CC.Stun                // 眩晕
State.CC.Root                // 定身
State.CC.Silence             // 沉默
State.CC.Disarm              // 缴械
State.Combat.Casting         // 正在施法
State.Combat.InCombat        // 战斗中
State.Combat.Invincible      // 无敌


// 现在用这些标签配置各个技能：

// ===== 火球术的标签配置 =====
// ① Ability Tags: Ability.Type.Active, Ability.Element.Fire
//    说明：火球术是主动技能、火系
//
// ② Cancel Abilities with Tags: (无)
//    说明：火球术不打断其他技能（瞬时释放）
//
// ③ Block Abilities with Tags: (无)
//    说明：火球术期间不阻止其他技能（释放瞬间就完了）
//
// ④ Activation Owned Tags: State.Combat.Casting
//    说明：释放时给角色加"施法中"标签（阻止移动）
//
// ⑤ Activation Required Tags: (无)
//    说明：任何时候都能尝试释放
//
// ⑥ Activation Blocked Tags: State.Dead, State.CC.Stun, State.CC.Silence
//    说明：死亡、眩晕、沉默时不能释放


// ===== 冲刺(Dash)的标签配置 =====
// ① Ability Tags: Ability.Type.Movement
//
// ② Cancel Abilities with Tags: Ability.Type.Channel
//    说明：冲刺时打断所有引导技能
//
// ③ Block Abilities with Tags: Ability.Type.Active
//    说明：冲刺期间不能释放其他主动技能
//
// ④ Activation Owned Tags: State.Combat.Dashing
//    说明：标记为冲刺状态
//
// ⑤ Activation Required Tags: (无)
//
// ⑥ Activation Blocked Tags: State.Dead, State.CC.Stun, State.CC.Root,
//                             State.Combat.Casting
//    说明：死亡/眩晕/定身/施法中 不能冲刺


// ===== 治疗术的标签配置 =====
// ① Ability Tags: Ability.Type.Channel, Ability.Element.Water
//    说明：治疗术是引导技能、水系
//
// ② Cancel Abilities with Tags: (无)
//    说明：治疗术不打断其他技能
//
// ③ Block Abilities with Tags: Ability.Type.Active, Ability.Type.Movement
//    说明：治疗引导期间，阻止所有主动技能和移动技能
//
// ④ Activation Owned Tags: State.Combat.Channeling
//    说明：标记为正在引导
//
// ⑤ Activation Required Tags: (无)
//
// ⑥ Activation Blocked Tags: State.Dead, State.CC.Stun, State.CC.Silence,
//                             State.CC.Root
//    说明：死亡/眩晕/沉默/定身 时不能治疗（定身也阻止，因为需要引导）
```

---

## 技能消耗 (CommitAbilityCost)

GA中的消耗通过GE来实现。你不需要在代码中手写 `Mana -= 20`，而是配置一个消耗GE。

```cpp
// ===== 在GA构造函数中设置消耗GE =====
UMyFireballAbility::UMyFireballAbility()
{
    // 设置消耗GE（消耗20法力）
    // 这个GE在CommitAbilityCost时自动应用
    // CostGameplayEffectClass 是 UGameplayAbility 的成员变量
    // 它定义了使用这个技能需要支付什么代价
    // CostGameplayEffectClass = UGE_FireballCost::StaticClass();
    // （通常在蓝图中设置，而非代码中硬编码）
    // 也可以在构造函数中设置：
    // static ConstructorHelpers::FClassFinder<UGameplayEffect> CostGEFinder(
    //     TEXT("/Game/GAS/GE/GE_FireballCost")
    // );
    // if (CostGEFinder.Succeeded())
    // {
    //     CostGameplayEffectClass = CostGEFinder.Class;
    // }
}

// CommitAbility 的完整流程
// 当你调用 CommitAbility() 时，内部执行顺序如下：

void UMyFireballAbility::ActivateAbility(...) 
{
    // CommitAbility 内部做了：
    // 1. 调用 CheckCost()  —— 检查消耗是否足够
    //    默认实现：检查CostGE能否应用到自身（法力够不够？）
    //
    // 2. 如果CheckCost失败 → 返回false，技能不能释放
    //
    // 3. 如果CheckCost成功 → 调用 ApplyCost()
    //    默认实现：应用CostGE到自身（扣除法力）
    //
    // 4. 调用 CommitAbilityCooldown()
    //    应用CooldownGE到自身（启动冷却）
    
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        // 消耗不足（法力不够）或冷却中
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }
    
    // Commit成功 → 法力已扣，冷却已启
    // ✅ 可以安全地执行技能逻辑
    SpawnFireball();
}
```

---

## 技能冷却 (CommitAbilityCooldown)

冷却同样通过GE实现：

```cpp
// ===== 冷却机制详解 =====

// 在GA构造函数中设置冷却GE
UMyFireballAbility::UMyFireballAbility()
{
    // 设置冷却GE（冷却3秒）
    // CooldownGameplayEffectClass 是 UGameplayAbility 的成员变量
    // CooldownGameplayEffectClass = UGE_FireballCooldown::StaticClass();
    // （通常在蓝图中设置）
}

// 冷却GE通常是一个 Duration 类型的GE：
// - Duration: 3.0秒
// - 没有Modifier（不需要修改属性）
// - 但添加了一个GameplayTag（如 Skill.Cooldown.Fireball）
// 
// 当冷却GE激活时，ASC上有 Skill.Cooldown.Fireball 标签
// GA的ActivationBlockedTags中应该包含 Skill.Cooldown.Fireball
// 冷却GE到期后，标签自动移除，技能恢复可用


// ===== 获取技能的剩余冷却时间 =====
float GetRemainingCooldown(UAbilitySystemComponent* ASC, 
                          FGameplayAbilitySpecHandle AbilityHandle)
{
    if (!ASC) return 0.0f;

    // 查找冷却GE的标签
    FGameplayTagContainer CooldownTags;
    ASC->GetCooldownTags(AbilityHandle, CooldownTags);

    // 查询冷却GE的剩余时间
    float TimeRemaining = 0.0f;
    float Duration = 0.0f;
    
    for (const FGameplayTag& Tag : CooldownTags)
    {
        ASC->GetActiveGameplayEffectRemainingTime(Tag, TimeRemaining, Duration);
        if (TimeRemaining > 0.0f)
        {
            break;
        }
    }
    
    return TimeRemaining;
}
```

---

## 技能实例化策略 (Instancing Policy)

这是一个重要的性能设计决策。

```
┌──────────────────────────────────────────────────────────────────────┐
│                GA 的三种实例化策略                                     │
│                                                                       │
│  策略1: Instanced Per Actor (每个角色一个实例)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  每个拥有该技能的角色，创建一个独立的GA实例                    │    │
│  │                                                               │    │
│  │  玩家A ──→ GA_Fireball 实例 #1（有自己的成员变量状态）        │    │
│  │  玩家B ──→ GA_Fireball 实例 #2（独立的成员变量状态）           │    │
│  │  敌人C ──→ GA_Fireball 实例 #3                               │    │
│  │                                                               │    │
│  │  ✅ 可以有成员变量（技能等级、累计伤害等）                     │    │
│  │  ✅ 可以有状态（该技能在这个角色上的冷却等）                   │    │
│  │  ✅ 最常用                                                     │    │
│  │  ⚠️ 创建时有开销（每个角色创建时都创建GA实例）                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  策略2: Instanced Per Execution (每次激活创建新实例)                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  每次TryActivateAbility成功时，创建一个新的GA实例             │    │
│  │                                                               │    │
│  │  玩家A第1次释放火球 ──→ GA_Fireball 实例 #1                  │    │
│  │  玩家A第2次释放火球 ──→ GA_Fireball 实例 #2                  │    │
│  │  玩家A第3次释放火球 ──→ GA_Fireball 实例 #3                  │    │
│  │                                                               │    │
│  │  ✅ 每次释放都是"干净"的状态                                  │    │
│  │  ✅ 适合需要延迟执行的技能                                    │    │
│  │  ❌ 有GC开销（每次创建新对象）                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  策略3: Non-Instanced (无实例——静态函数调用)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  不创建GA实例，直接调用类的静态函数                            │    │
│  │                                                               │    │
│  │  ❌ 不能有成员变量                                            │    │
│  │  ❌ 不能有状态                                                │    │
│  │  ❌ 不能绑定委托                                              │    │
│  │  ✅ 性能最高（零GC开销）                                       │    │
│  │  ✅ 适合极高频的简单技能（如每帧检测的被动技能）               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

```cpp
// ===== 实例化策略的选择指南 =====

UCLASS()
class UMyFireballAbility : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UMyFireballAbility()
    {
        // ✅ 推荐：InstancedPerActor（最常用）
        // 适合99%的技能——有状态、有成员变量、合理性能
        InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;
    }
};

UCLASS()
class UMyDelayedBlast : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UMyDelayedBlast()
    {
        // ✅ 延迟执行的技能使用 InstancedPerExecution
        // 因为需要在技能运行期间持有数据（计时器等）
        InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerExecution;
    }
};

UCLASS()
class UMyPassiveRegen : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UMyPassiveRegen()
    {
        // ✅ 高频被动技能使用 NonInstanced
        // 不需要成员变量，只需要每次激活时执行一段逻辑
        InstancingPolicy = EGameplayAbilityInstancingPolicy::NonInstanced;
    }
};
```

### 网络执行策略

```cpp
// ===== NetExecutionPolicy 配置 =====

UMyFireballAbility::UMyFireballAbility()
{
    // ServerOnly: 仅在服务器执行（客户端请求→服务器执行→同步结果）
    // 适合：伤害技能、修改属性的技能
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerOnly;
}

UMyDashAbility::UMyDashAbility()
{
    // ServerInitiated: 服务器启动执行（服务器权威的移动）
    // 适合：怪物AI技能、服务器控制的单位
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerInitiated;
}

UMyJumpAbility::UMyJumpAbility()
{
    // LocalPredicted: 本地预测执行（客户端先执行→服务器验证）
    // 适合：移动技能（需要低延迟手感）
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;
    
    // 只有LocalPredicted才需要配置这个
    NetSecurityPolicy = EGameplayAbilityNetSecurityPolicy::ClientOrServer;
}
```

---

## GA的异步任务

某些技能需要"等待"——等待动画完成、等待延迟、等待目标选择等。GAS提供了异步任务机制。

```cpp
// ===== 在ActivateAbility中使用异步任务 =====

#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "Abilities/Tasks/AbilityTask_WaitDelay.h"
#include "Abilities/Tasks/AbilityTask_WaitTargetData.h"

void UMyFireballAbility::ActivateAbility(...)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }

    // ===== 异步任务1：播放动画并等待完成 =====
    if (CastingMontage)
    {
        // 创建一个异步任务：播放蒙太奇，等待它完成或中断
        UAbilityTask_PlayMontageAndWait* MontageTask = 
            UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
                this,                              // OwningAbility
                TEXT("FireballMontage"),           // TaskInstanceName
                CastingMontage,                    // 要播放的蒙太奇
                1.0f,                              // 播放速率
                NAME_None                          // 起始Section
            );

        // 绑定蒙太奇完成回调
        MontageTask->OnCompleted.AddDynamic(this, &UMyFireballAbility::OnMontageCompleted);
        
        // 绑定蒙太奇中断回调（被伤害打断等）
        MontageTask->OnInterrupted.AddDynamic(this, &UMyFireballAbility::OnMontageCancelled);
        
        // 绑定蒙太奇混合回调
        MontageTask->OnBlendOut.AddDynamic(this, &UMyFireballAbility::OnMontageCompleted);

        // 激活任务（开始播放）
        MontageTask->ReadyForActivation();
    }

    // ===== 异步任务2：等待0.5秒后生成火球 =====
    UAbilityTask_WaitDelay* DelayTask = UAbilityTask_WaitDelay::WaitDelay(
        this,
        0.5f  // 延迟0.5秒（配合动画的"出手"时间点）
    );
    DelayTask->OnFinish.AddDynamic(this, &UMyFireballAbility::OnDelayFinished);
    DelayTask->ReadyForActivation();
}

void UMyFireballAbility::OnDelayFinished()
{
    // 延迟结束后，动画应该到了"出手"帧
    // 此时生成火球投射物
    SpawnFireball();
}

void UMyFireballAbility::OnMontageCompleted()
{
    // 蒙太奇播放完成，技能也可以结束了
    // 注意：不要重复EndAbility
}

void UMyFireballAbility::OnMontageCancelled()
{
    // 动画被中断 → 取消技能
    CancelAbility(GetCurrentAbilitySpecHandle(), GetCurrentActorInfo(), 
                  GetCurrentActivationInfo(), true);
}
```

---

## 完整技能代码示例——火球术（最终版）

```cpp
// ===== MyFireballAbility.h（最终完整版）=====
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "MyFireballAbility.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FFireballAbilityDelegate, 
    float, DamageDealt);

/**
 * 火球术技能
 * 
 * 功能说明：
 * - 消耗20法力，冷却3秒
 * - 不能被眩晕/沉默时使用
 * - 释放时标记"施法中"阻止移动
 * - 延迟0.5秒（配合动画）后生成火球投射物
 * - 造成火焰伤害
 */
UCLASS()
class MYGAME_API UMyFireballAbility : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UMyFireballAbility();

    // ===== 核心生命周期 =====
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData
    ) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled
    ) override;

    // ===== 事件广播 =====
    // 火球命中敌人时触发
    UPROPERTY(BlueprintAssignable, Category = "Fireball")
    FFireballAbilityDelegate OnFireballHit;

protected:
    // ===== 蓝图中可配置的属性 =====

    // 施法动画蒙太奇
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Animation")
    class UAnimMontage* CastingMontage;

    // 火球投射物类
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Projectile")
    TSubclassOf<class AMyProjectile> ProjectileClass;

    // 投射物生成位置偏移
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Projectile")
    FVector SpawnOffset = FVector(100.0f, 0.0f, 0.0f);

    // 伤害GE类（用于配置基础伤害）
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Damage")
    TSubclassOf<class UGameplayEffect> DamageEffectClass;

    // 基础伤害值（实际的伤害在GE中由AttributeBased计算）
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Damage")
    float BaseDamage = 50.0f;

    // 延迟多久后生成火球（秒）
    UPROPERTY(EditDefaultsOnly, Category = "Fireball|Timing")
    float SpawnDelay = 0.5f;

    // ===== 异步任务回调 =====
    UFUNCTION()
    void OnSpawnDelayFinished();

    UFUNCTION()
    void OnMontageBlendOut();

    UFUNCTION()
    void OnMontageInterrupted();

private:
    // 执行火球生成
    void ExecuteFireball();

    // 已生成的投射物引用（用于追踪）
    TWeakObjectPtr<AActor> SpawnedProjectile;
};
```

```cpp
// ===== MyFireballAbility.cpp（最终完整版）=====
#include "MyFireballAbility.h"
#include "AbilitySystemComponent.h"
#include "Abilities/Tasks/AbilityTask_PlayMontageAndWait.h"
#include "Abilities/Tasks/AbilityTask_WaitDelay.h"
#include "MyProjectile.h"

UMyFireballAbility::UMyFireballAbility()
{
    // ===== 实例化和网络策略 =====
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerOnly;
    // ServerOnly: 客户端请求，服务器执行并同步结果

    // ===== 技能标签配置 =====

    // ① 这个技能自身有什么标签
    AbilityTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("Ability.Type.Active"))
    );
    AbilityTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("Ability.Element.Fire"))
    );

    // ② 激活时取消哪些标签的技能（火球术不打断其他技能）
    // 留空

    // ③ 激活期间阻止哪些标签的技能的激活（火球瞬时，不阻塞）
    // 留空

    // ④ 激活时给ASC加哪些临时标签
    // "施法中"标签 —— 阻止移动
    ActivationOwnedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.Combat.Casting"))
    );

    // ⑤ 需要哪些标签才能激活
    // 火球术不需要特定状态标签就能释放
    // ActivationRequiredTags 留空

    // ⑥ 有这些标签时不能激活
    ActivationBlockedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.Dead"))
    );
    ActivationBlockedTags.AddTag(
        FGameplayTag::RequestGameplayTag(FName("State.CC"))
        // 使用父级标签 State.CC 会匹配所有控制效果！
        // 包括 Stun/Root/Silence/Disarm 等所有子标签
    );
}

void UMyFireballAbility::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    // ===== 步骤1：提交技能（检查消耗、启动冷却）=====
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        // 消耗不足或冷却中 → 结束技能
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }

    // ===== 步骤2：播放施法动画 =====
    if (CastingMontage && ActorInfo && ActorInfo->AvatarActor.IsValid())
    {
        UAbilityTask_PlayMontageAndWait* MontageTask = 
            UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
                this,
                TEXT("FireballCasting"),
                CastingMontage,
                1.0f,
                NAME_None,
                true,   // bStopWhenAbilityEnds - 技能结束时自动停止动画
                1.0f    // 动画混合时间
            );

        // 绑定蒙太奇事件
        MontageTask->OnBlendOut.AddDynamic(this, &UMyFireballAbility::OnMontageBlendOut);
        MontageTask->OnInterrupted.AddDynamic(this, &UMyFireballAbility::OnMontageInterrupted);
        MontageTask->ReadyForActivation();
    }

    // ===== 步骤3：延迟后生成火球 =====
    UAbilityTask_WaitDelay* DelayTask = UAbilityTask_WaitDelay::WaitDelay(
        this,
        SpawnDelay  // 0.5秒后（配合动画"出手"帧）
    );
    DelayTask->OnFinish.AddDynamic(this, &UMyFireballAbility::OnSpawnDelayFinished);
    DelayTask->ReadyForActivation();

    // 注意：这里不立即 EndAbility 
    // 技能会等动画结束或火球生成后才结束
}

void UMyFireballAbility::OnSpawnDelayFinished()
{
    // 延迟结束，生成火球
    ExecuteFireball();
}

void UMyFireballAbility::ExecuteFireball()
{
    // 获取角色信息
    const FGameplayAbilityActorInfo* ActorInfo = GetActorInfo();
    if (!ActorInfo || !ActorInfo->AvatarActor.IsValid())
    {
        EndAbility(GetCurrentAbilitySpecHandle(), GetCurrentActorInfo(),
                   GetCurrentActivationInfo(), true, true);
        return;
    }

    // 获取世界和Avatar
    AActor* Avatar = ActorInfo->AvatarActor.Get();
    UWorld* World = Avatar->GetWorld();
    if (!World || !ProjectileClass)
    {
        return;
    }

    // 计算生成位置和朝向
    FVector SpawnLocation = Avatar->GetActorLocation() + 
                            Avatar->GetActorRotation().RotateVector(SpawnOffset);
    FRotator SpawnRotation = Avatar->GetActorRotation();

    // 配置生成参数
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = Avatar;
    SpawnParams.Instigator = Cast<APawn>(Avatar);
    SpawnParams.SpawnCollisionHandlingOverride = 
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    // 生成投射物
    AMyProjectile* Projectile = World->SpawnActor<AMyProjectile>(
        ProjectileClass,
        SpawnLocation,
        SpawnRotation,
        SpawnParams
    );

    if (Projectile)
    {
        // 把伤害GE类传递给投射物
        Projectile->SetDamageParams(
            DamageEffectClass,
            ActorInfo->AbilitySystemComponent.Get(),
            BaseDamage
        );

        SpawnedProjectile = Projectile;
    }
}

void UMyFireballAbility::OnMontageBlendOut()
{
    // 蒙太奇正常播放完成（混合结束）
    if (!SpawnedProjectile.IsValid())
    {
        // 如果因为某种原因还没生成火球，现在生成
        ExecuteFireball();
    }

    // 结束技能
    EndAbility(GetCurrentAbilitySpecHandle(), GetCurrentActorInfo(),
               GetCurrentActivationInfo(), true, false);
}

void UMyFireballAbility::OnMontageInterrupted()
{
    // 动画被中断（比如被击倒了）
    // 取消技能（消耗和冷却会回滚...吗？）
    // ⚠️ 注意：如果已经Commit了，消耗和冷却不会回滚
    // 需要根据设计决定是否返还消耗
    CancelAbility(GetCurrentAbilitySpecHandle(), GetCurrentActorInfo(),
                  GetCurrentActivationInfo(), true);
}

void UMyFireballAbility::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    // 清理引用
    SpawnedProjectile.Reset();

    // ⚠️ 重要：必须调用Super
    // Super::EndAbility 会：
    // 1. 清理异步任务
    // 2. 移除ActivationOwnedTags
    // 3. 通知ASC技能已结束
    // 4. 处理网络同步
    Super::EndAbility(Handle, ActorInfo, ActivationInfo,
                      bReplicateEndAbility, bWasCancelled);
}
```

---

## ✅ 正确做法 vs ❌ 错误做法

```cpp
// ===== 技能的"正确"和"错误"用法 =====

// ✅ 正确：在ActivateAbility中调用CommitAbility
void UMyAbility::ActivateAbility(...)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }
    // 之后才执行技能逻辑
}

// ❌ 错误：忘记CommitAbility就开始执行技能逻辑
void UMyAbility::ActivateAbility(...)
{
    SpawnFireball();  // 还没检查消耗和冷却！
}

// ✅ 正确：技能结束时调用Super::EndAbility
void UMyAbility::EndAbility(...)
{
    Super::EndAbility(...);  // 必须！
}

// ❌ 错误：忘记调用Super::EndAbility
// 导致标签没有清理，异步任务没有停止

// ✅ 正确：使用Tags来阻止技能（配置层面）
// 在构造函数中：
ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(
    FName("State.CC.Stun")
));

// ❌ 错误：在代码中硬编码条件检查
void UMyAbility::ActivateAbility(...)
{
    // ❌ 不要在代码中手动检查——用标签配置！
    AMyCharacter* Char = Cast<AMyCharacter>(ActorInfo->AvatarActor);
    if (Char && Char->bIsStunned)  // 不要这样做！
    {
        return;
    }
}
```

---

## 完成检查清单

- [ ] 你能画出GA的完整生命周期图（Give → Activate → Commit → End/Cancel）吗？
- [ ] 你能解释六种技能标签各自的作用吗？
- [ ] 你知道CommitAbility内部做了什么吗？
- [ ] 你能写出一个完整的火球术GA代码吗？
- [ ] 你能区分三种实例化策略的适用场景吗？
- [ ] 你理解GA如何使用异步任务处理延迟和动画吗？
- [ ] 你能说出NetExecutionPolicy的三种选项及其适用场景吗？
- [ ] 你知道为什么应该用标签配置而非硬编码条件判断吗？

---

> **下一节**：[13.4 GameplayEffect](./04-GameplayEffect.md) — 深入效果的配方和执行机制
