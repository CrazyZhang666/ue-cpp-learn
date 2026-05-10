# 13.1 GAS概述与架构

> **目标**：理解Gameplay Ability System（GAS）是什么、为什么需要它、以及它的整体架构。

---

## 本章引言

```
                          ┌─────────────────────────────────────────────┐
                          │     GAS 是 UE5 中最复杂的系统，也是最强大的    │
                          │                                              │
                          │  学会GAS ≈ 拿到高级UE开发岗位的入场券          │
                          │                                              │
                          │  本章是理解GAS的基础，不要跳！                 │
                          └─────────────────────────────────────────────┘
```

GAS（Gameplay Ability System）是Epic为UE4/UE5开发的一套**技能系统框架**。它最初是为《堡垒之夜》和《Paragon》开发的，经过多年实战检验，现在已经成为UE5官方推荐的游戏逻辑核心系统。

用一句话概括：**GAS是一套让你用数据驱动的方式搭建角色属性、技能、Buff/Debuff、状态管理的完整框架，并且内置了网络同步支持。**

---

## GAS是什么——先有一个直观理解

### 没有GAS时，做一个技能系统会怎样？

假设你要做一个简单的"火球术"技能：

```cpp
// ❌ 没有GAS时，你可能会这样写
void AMyCharacter::CastFireball()
{
    // 1. 检查法力值够不够
    if (Mana < FireballCost)
    {
        DebugMessage("法力不足！");
        return;
    }

    // 2. 减去法力消耗
    Mana -= FireballCost;

    // 3. 启动冷却计时器
    if (bIsOnCooldown)
    {
        DebugMessage("技能冷却中！");
        return;
    }
    GetWorldTimerManager().SetTimer(CooldownTimer, this,
        &AMyCharacter::OnFireballCooldownEnd, CooldownTime, false);
    bIsOnCooldown = true;

    // 4. 检查是否被眩晕
    if (bIsStunned)
    {
        DebugMessage("被眩晕中，无法释放！");
        Mana += FireballCost;  // 别忘了还回法力！
        return;
    }

    // 5. 创建火球生成逻辑
    FActorSpawnParameters SpawnParams;
    SpawnParams.Owner = this;
    AFireballProjectile* Fireball = GetWorld()->SpawnActor<AFireballProjectile>(
        FireballClass, GetActorLocation(), GetActorRotation(), SpawnParams);

    // 6. 处理网络同步（各端都要看到火球）
    if (HasAuthority())
    {
        // 服务器端逻辑
        MulticastSpawnFireball(Fireball->GetActorLocation());
    }

    // ...每个技能都要写类似的代码，而且分散在角色类的各处
    // ...策划想改个冷却时间？重新编译！
    // ...加个新技能？需要改角色类代码！
    // ...Buff系统？再写一套类似的框架！
}
```

**问题显而易见**：每个技能都在重复类似的逻辑检测，代码散落在角色类的各个函数中，新增或修改技能必须改C++代码，网络同步更是噩梦。

### 有GAS时，同样的需求变成：

```cpp
// ✅ 使用GAS——大部分工作在数据层面完成，不需要写这么多代码

// 1. 在蓝图中创建"火球术"GA资产，配置：
//    - Cost: 消耗20法力（GE配数据）
//    - Cooldown: 冷却3秒（GE配数据）
//    - Activation Blocked Tags: State.CC.Stun（眩晕时无法释放）
//    - Activation Owned Tags: State.Casting（释放中标记）

// 2. C++代码只需要写核心逻辑：
void UFireballAbility::ActivateAbility(...)
{
    // GAS已经帮你检查了：法力够不够、是否冷却中、是否被眩晕

    // 你只需要写技能本身的核心逻辑
    SpawnFireball();  // 生成火球

    CommitAbility();  // 提交技能——GAS自动处理消耗和冷却
    EndAbility();     // 结束技能——GAS自动清理状态标签
}
```

**核心思想**：GAS把"技能的共性需求"（消耗检测、冷却管理、状态判断、网络同步）都帮你做好了。你只需要**专注于技能本身的独特逻辑**。

---

## GAS解决的六大问题

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     GAS 解决的六大核心问题                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│   │ 1. 属性管理  │  │ 2. 技能系统  │  │ 3. 效果系统  │                      │
│   │ Health/Mana  │  │ 释放/冷却   │  │ Buff/Debuff  │                      │
│   │ Attack/Def   │  │ 消耗/条件   │  │ 持续效果     │                      │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
│          │                │                │                              │
│   ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐                      │
│   │ 4. 标签系统  │  │ 5. 网络同步  │  │ 6. 数据驱动  │                      │
│   │ 眩晕/无敌    │  │ 多人自动同步│  │ 策划可配置   │                      │
│   │ 飞行/施法    │  │ 客户端预测  │  │ 不改代码     │                      │
│   └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 问题1：属性管理

在没有GAS的项目中，你可能会这样管理角色属性：

```cpp
// ❌ 没有GAS——属性散落在Actor的成员变量中
class AMyCharacter : public ACharacter
{
    float Health = 100.0f;
    float MaxHealth = 100.0f;
    float Mana = 50.0f;
    float MaxMana = 50.0f;
    float AttackPower = 10.0f;
    float Defense = 5.0f;
    float MoveSpeed = 600.0f;

    // 问题1：每个变量都要单独处理网络同步（Replicated）
    // 问题2：Buff加成很难追踪（"攻击力+20%"来自哪个Buff？）
    // 问题3：临时修改和永久修改混在一起（装备加成 vs 技能Buff）
    // 问题4：数值变化没有统一的回调机制
};
```

**GAS的解决方案**：将所有属性统一管理在`AttributeSet`中，每个属性都是有"来源追踪"的，变化时自动触发回调。

```cpp
// ✅ 使用GAS——属性统一管理在AttributeSet中
UCLASS()
class UMyAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    // 每个属性都使用FGameplayAttributeData——GAS内置类型
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_Health)
    FGameplayAttributeData Health;     // 当前生命值

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;  // 最大生命值

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing = OnRep_AttackPower)
    FGameplayAttributeData AttackPower; // 攻击力

    // GAS自动追踪：这个属性的当前值 = BaseValue + 所有Active GE的修改之和
    // 当某个Buff到期时，它的加成会自动移除，不需要手动处理
};
```

### 问题2：技能系统

没有GAS时，每个技能都是独立实现的，缺乏统一的"技能调度中心"。

```cpp
// ❌ 没有GAS——技能各自为政
void AMyCharacter::Input_Fireball()    { /* 手动处理冷却、消耗 */ }
void AMyCharacter::Input_Heal()        { /* 又写一遍冷却、消耗逻辑 */ }
void AMyCharacter::Input_Dash()        { /* 还要再写一遍... */ }
```

**GAS的解决方案**：`AbilitySystemComponent（ASC）`作为统一调度中心，统一处理所有技能的激活、冷却、消耗、取消。

```
                          玩家按键盘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   AbilitySystemComponent (ASC) │  ← 统一调度中心
              │                                │
              │  "玩家想释放技能X"              │
              │         │                      │
              │         ├─ 技能X有消耗吗？      │
              │         ├─ 冷却好了吗？         │
              │         ├─ 玩家有释放权限吗？   │
              │         ├─ 玩家被眩晕了吗？     │
              │         └─ 全部通过 → 激活技能   │
              └───────────────────────────────┘
```

### 问题3：效果系统（Buff/Debuff）

```cpp
// ❌ 没有GAS——处理Buff的各种情况非常复杂
// 场景：角色被施放了"攻击力提升20%，持续10秒"的Buff

// 10秒后Buff到期 → 需要还原攻击力
// 中途角色死亡 → 需要移除所有Buff
// 新Buff和旧Buff叠加 → 需要判断叠加规则
// 同类型来源多个Buff → 取最大值还是叠加？
// 网络同步 → 客户端也要看到Buff图标和粒子效果
```

**GAS的解决方案**：`GameplayEffect（GE）`就是效果的"配方"，一切Buff/Debuff/瞬时伤害/持续性效果都用GE实现。

```
┌────────────────────────────────────────────────────┐
│               GameplayEffect 就像一个"效果配方"       │
│                                                    │
│  "攻击力提升Buff"的配方（数据配置，不需要写代码）：      │
│                                                    │
│  Duration Policy: Duration (持续)                   │
│  Duration: 10.0秒                                  │
│  Modifiers: AttackPower * 1.2 (乘法增加20%)          │
│  Stacking: 最多3层                                  │
│  Tags: Buff.AttackUp (标签标记)                     │
│  Cues: 播放Buff特效音效                              │
│                                                    │
│  当这个GE"应用"到目标身上时：                          │
│  1. 攻击力自动乘以1.2                                │
│  2. 自动播放BUFF粒子效果                             │
│  3. 10秒后自动移除，攻击力自动还原                     │
│  4. 死亡时自动移除                                   │
│  ── 所有这些都是GAS自动处理的！                       │
└────────────────────────────────────────────────────┘
```

### 问题4：标签系统

```cpp
// ❌ 没有GAS——用bool变量管理角色状态
class AMyCharacter : public ACharacter
{
    bool bIsStunned = false;       // 是否被眩晕
    bool bIsInvincible = false;    // 是否无敌
    bool bIsCasting = false;       // 是否正在施法
    bool bIsRooted = false;        // 是否被定身
    bool bIsFlying = false;        // 是否飞行中
    bool bIsStealthed = false;     // 是否隐身中

    // 问题1：每加一个新状态就要加一个bool变量
    // 问题2："所有控制效果" = bIsStunned || bIsRooted || bIsSilenced || ...
    //        每加一个控制效果都要更新这个判断
    // 问题3：技能是否可用 = !bIsStunned && !bIsCasting && !bIsDead
    //        条件判断散落在各处，修改时容易遗漏
};
```

**GAS的解决方案**：`GameplayTag`——层级的、可组合的标签系统。

```
                    用标签替代bool变量

    State.CC.Stun        ← 替代 bIsStunned
    State.CC.Root        ← 替代 bIsRooted
    State.CC.Silence     ← 替代 bIsSilenced
    State.Combat.Invincible ← 替代 bIsInvincible
    State.Combat.Casting ← 替代 bIsCasting
    State.Movement.Flying ← 替代 bIsFlying

    查询"是否有任何控制效果" → 只需检查 HasTag(State.CC)
    查询"能否释放技能"     → 只需检查 !HasTag(State.CC)

    新增"沉睡"状态 → 加个 State.CC.Sleep 即可，不需要改任何代码！
```

**标签系统的层级匹配**是它最大的优势。比如你可以定义：

```
State                    ← 所有状态
State.CC                 ← 所有控制效果（Crowd Control）
State.CC.Stun            ← 眩晕（无法移动、无法攻击）
State.CC.Root            ← 定身（无法移动、可以攻击）
State.CC.Silence         ← 沉默（无法释放技能）
State.CC.Disarm          ← 缴械（无法普通攻击）
State.Invincible         ← 无敌
State.Dead               ← 死亡
```

当玩家需要判断"能否释放技能"时，只需要检查 `!HasAny(State.CC, State.Dead)`。以后新增的任何控制效果（只要它的标签以`State.CC`开头），都会自动被这个检测拦截 —— 一行代码都不用改。

### 问题5：网络同步

多人在线游戏中，技能系统的网络同步是最容易出Bug的地方之一。

```cpp
// ❌ 没有GAS——手动处理网络同步
// 需要考虑的问题：
// - 属性变化如何从服务器同步到客户端？
// - 客户端预测（按下技能键立即播放动画，不等待服务器确认）
// - 服务器权威验证（客户端不能作弊修改自己的属性）
// - 延迟补偿（高延迟下玩家的操作体验）
// - 各端播放粒子/音效的一致性
// - Buff的持续时间在各端保持一致
```

**GAS的解决方案**：GAS在设计之初就是为多人游戏而生的。它内置了：

| GAS的网络功能    | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| **属性自动同步** | AttributeSet中的属性可以用 `ReplicatedUsing` 自动同步 |
| **预测系统**     | 客户端可以"预测"技能激活，服务器验证后确认或回滚      |
| **服务器权威**   | 所有属性修改最终由服务器确认，客户端输入只是"请求"    |
| **GameplayCue**  | 统一的视觉/音效反馈机制，自动处理同步/预测            |
| **GE的同步**     | 预测类GE（Predicted）可以本地先应用再等服务器确认     |

```
客户端预测的流程：

    客户端按下技能键
        │
        ▼
    ┌──────────────────┐
    │ 预测技能激活      │  ← 立即显示动画和特效（不等待服务器）
    │ 预测消耗法力值    │  ← 本地先扣法力
    │ 预测应用伤害      │  ← 受伤效果立即显示
    └──────┬───────────┘
           │
           ▼ 同时发送RPC到服务器
    ┌──────────────────┐
    │ 服务器验证        │
    │ ├─ 法力够吗？     │
    │ ├─ 冷却好了吗？   │
    │ └─ 目标有效吗？   │
    └──────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  验证通过     验证失败
  确认所有     回滚所有
  预测结果     预测结果
  (客户端感    (客户端法力
   觉不出      值被"弹回"
   延迟)      原始值)
```

### 问题6：数据驱动

```cpp
// ❌ 没有GAS——数值硬编码在代码中
const float FireballDamage = 50.0f;      // 改伤害要重新编译！
const float FireballCooldown = 3.0f;     // 改冷却要重新编译！
const float FireballManaCost = 20.0f;    // 改消耗要重新编译！
const float BuffDuration = 10.0f;        // 改持续时间要重新编译！
```

**GAS的解决方案**：技能和效果都是**数据资产**，策划在编辑器中就可以调整所有数值，不需要改C++代码。

```
策划的工作流 ── 数据驱动

    [策划] 打开GA_Fireball蓝图资产
         │
         ├─ 修改冷却时间：3秒 → 2.5秒（直接改数字）
         ├─ 修改消耗：20法力 → 15法力
         ├─ 修改伤害：50 → 45
         └─ 修改描述文本
                │
                ▼
        保存资产 → 不需要编译 → 不需要重启编辑器 → 立即生效
```

---

## GAS的核心组件架构

现在让我们从宏观上看GAS的六大部分及它们之间的关系。

### 架构全景图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GAS 核心组件架构                                  │
│                                                                         │
│   ┌──────────────────────────────────────── ───────────────────────┐    │
│   │                     AbilitySystemComponent (ASC)               │    │
│   │                         ┌────────────┐                         │    │
│   │                         │  "大脑"    │                         │    │
│   │                         │ 调度中心   │                         │    │
│   │                         └─────┬──────┘                         │    │
│   │         ┌─────┬─────┬─────┬───┴───┬─────┬─────┐               │    │
│   │         ▼     ▼     ▼     ▼       ▼     ▼     ▼               │    │
│   │       [GA]  [GA]  [GA]  [AS]   [GE]  [GT]  [GC]              │    │
│   │       技能  技能  技能   属性     效果  标签   表现             │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   组件关系说明：                                                         │
│                                                                         │
│   GA（技能）──→ 通过ASC激活 ──→ 检查GT（标签）是否满足条件               │
│                               ──→ 应用GE（效果）造成伤害/加成            │
│                               ──→ 修改AS（属性）                         │
│                               ──→ 触发GC（表现）播放特效                  │
│                               ──→ 添加GT（标签）标记状态                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 六大组件逐一介绍

```
═══════════════════════════════════════════════════════════════════════════
  组件1: AbilitySystemComponent (ASC) ── GAS的大脑
═══════════════════════════════════════════════════════════════════════════

  类比：MVC中的Controller（控制器）

  职责：
  ┌─────────────────────────────────────────────┐
  │  • 管理所有技能（GA）的授予、激活、取消     │
  │  • 管理所有效果（GE）的应用和移除           │
  │  • 管理标签（GT）的增删查改                 │
  │  • 管理属性（AS）的查询和监听               │
  │  • 协调网络同步（预测/确认/回滚）           │
  │  • 管理GameplayCue（GC）的触发              │
  └─────────────────────────────────────────────┘

  ⚠️ 重要：一个Actor通常只有一个ASC
  ⚠️ 重要：ASC应该放在PlayerState（玩家）或Character（AI）上


═══════════════════════════════════════════════════════════════════════════
  组件2: GameplayAbility (GA) ── 技能的定义
═══════════════════════════════════════════════════════════════════════════

  类比：一个技能的"蓝图"或"说明书"

  每个GA就是一个独立的技能：
  ┌─────────────────────────────────────────────┐
  │  UGA_Fireball    → 火球术                   │
  │  UGA_Heal        → 治疗术                   │
  │  UGA_Dash        → 冲刺                     │
  │  UGA_Jump        → 跳跃（是的，跳跃也可以是技能）│
  │  ...                                        │
  └─────────────────────────────────────────────┘

  GA不直接存储数据（伤害值等），而是通过GE来"声明"它想要做什么。

  一个GA的生命周期：
  给予(Give) → 激活(Activate) → 执行 → 提交(Commit) → 结束(End)/取消(Cancel)


═══════════════════════════════════════════════════════════════════════════
  组件3: GameplayEffect (GE) ── 效果的配方
═══════════════════════════════════════════════════════════════════════════

  类比：一个"效果配方"——定义了"对属性做什么修改"

  GE不是直接在代码中操作属性，而是声明式地描述修改：

  "我想把目标的Health属性减少50（基于攻击力计算）"
  "我想把目标的MoveSpeed属性乘以0.5（减速50%）"
  "我想把目标的AttackPower属性增加20%（持续10秒）"

  GE的类型：
  ┌──────────────────┬──────────────────────────────────┐
  │ Instant（瞬时）   │ 立即生效一次，如伤害、治疗       │
  │ Duration（持续）  │ 持续一段时间，如10秒攻击力Buff    │
  │ Infinite（无限）  │ 无限持续，需要手动移除（如装备属性）│
  │ Periodic（周期）  │ 按时间间隔重复触发（如每秒扣血的毒）│
  └──────────────────┴──────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
  组件4: GameplayTag (GT) ── 层级标签系统
═══════════════════════════════════════════════════════════════════════════

  类比：给角色贴"便利贴"，用来标记各种状态

  标签格式：Parent.Child.GrandChild（层级制）

  示例：
  State.Dead               ← 死亡状态
  State.CC.Stun            ← 眩晕（CC = Crowd Control）
  State.CC.Root            ← 定身
  State.Combat.Casting     ← 正在施法
  Buff.AttackUp            ← 攻击力提升Buff
  Ability.Fire.Magic       ← 火系魔法技能

  标签的核心作用：
  • 条件判断：有 State.CC 标签 → 不能释放技能
  • 状态标记：施法时自动添加 State.Combat.Casting 标签
  • 取消控制：收到 State.CC.Stun → 取消当前技能
  • 免疫机制：有 State.Invincible → 免疫所有伤害GE


═══════════════════════════════════════════════════════════════════════════
  组件5: AttributeSet (AS) ── 属性集合
═══════════════════════════════════════════════════════════════════════════

  类比：D&D角色卡上的属性栏

  包含所有"数值属性"：
  ┌─────────────────────────────────────────────┐
  │  Health（生命值）     MaxHealth（最大生命）   │
  │  Mana（法力值）       MaxMana（最大法力）     │
  │  Stamina（体力值）    MaxStamina（最大体力）  │
  │  AttackPower（攻击力） Defense（防御力）      │
  │  MoveSpeed（移动速度） AttackSpeed（攻击速度） │
  │  CriticalChance（暴击率）CriticalDamage（暴击伤害）│
  └─────────────────────────────────────────────┘

  每个属性都有：
  • BaseValue（基础值）：装备、等级带来的永久加成
  • CurrentValue（当前值）：BaseValue + 所有临时GE的加成之和

  属性变化时触发回调：
  • PreAttributeChange：修改前回调（用于Clamp，限制值域）
  • PostGameplayEffectExecute：GE生效后回调（用于处理死亡等逻辑）


═══════════════════════════════════════════════════════════════════════════
  组件6: GameplayCue (GC) ── 视觉/音效反馈
═══════════════════════════════════════════════════════════════════════════

  类比：技能的表现层——"技能看起来和听起来是什么样的"

  GC和GE是分离的：
  ┌─────────────────────────────────────────────┐
  │  GE负责逻辑：伤害值是多少、Buff持续多久       │
  │  GC负责表现：播放什么粒子、什么音效、什么动画  │
  └─────────────────────────────────────────────┘

  分离的好处：
  • 策划改伤害数值 → 不用管表现层代码
  • 美术替换特效 → 不用管逻辑层代码
  • 可以在蓝图中轻松实现GC，不需要C++

  GC的触发方式：
  • GE的GameplayCue标签自动触发
  • 通过ASC手动调用 ExecuteGameplayCue / AddGameplayCue
```

---

## 六大组件的工作流程——以"火球术"为例

让我们追踪一个完整的火球术技能在GAS中的完整流程，理解六个组件如何协作。

```
玩家按下"1"键（火球术快捷键）
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤1：ASC接收激活请求                                           │
│                                                                 │
│ 输入系统 → ASC::TryActivateAbility(FireballAbility)             │
│                                                                 │
│ ASC开始检查：                                                    │
│  ├─ 这个GA已经给角色了吗？（Give状态）          ✅ 已给予         │
│  ├─ 角色有 State.CC 标签吗？                   ✅ 没有，可以释放  │
│  ├─ 角色有 State.Combat.Casting 标签吗？       ✅ 没有           │
│  ├─ 角色有 State.Dead 标签吗？                 ✅ 没有           │
│  └─ 冷却好了吗？（Cooldown GE还在吗？）        ✅ 冷却已好       │
│                                                                 │
│ 全部通过 → 激活技能                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤2：GA开始执行 (ActivateAbility)                              │
│                                                                 │
│ UFireballAbility::ActivateAbility()                             │
│ {                                                               │
│     // 创建消耗GE（扣除法力）                                    │
│     // 等待提交确认                                              │
│ }                                                               │
│                                                                 │
│ 激活时添加标签：                                                 │
│  ASC::AddLooseGameplayTag(State.Combat.Casting)                 │
│  → 现在角色有"施法中"标签，阻止移动和其他技能                      │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤3：GA提交 (CommitAbility)                                    │
│                                                                 │
│ CommitAbility() 做了两件事：                                     │
│                                                                 │
│ ① CommitAbilityCost()                                           │
│    → 应用消耗GE到自身                                            │
│    → Mana -= 20（应用消耗GE）                                     │
│    → 如果法力不够，Commit失败，技能取消                            │
│                                                                 │
│ ② CommitAbilityCooldown()                                       │
│    → 应用冷却GE到自身                                            │
│    → 接下来3秒内无法再次激活火球术                                │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤4：技能核心逻辑                                               │
│                                                                 │
│ // 生成火球投射物                                                │
│ SpawnFireball();                                                 │
│                                                                 │
│ // 火球命中的处理在碰撞回调中：                                   │
│ OnFireballHit(AActor* Target)                                    │
│ {                                                               │
│     // 创建伤害GE的Spec（实例）                                   │
│     FGameplayEffectSpecHandle DamageSpec =                      │
│         ASC->MakeOutgoingSpec(DamageGE, Level, Context);        │
│                                                                 │
│     // 设置"调用者设置的伤害值"                                   │
│     DamageSpec.Data->SetSetByCallerMagnitude(                    │
│         MyDamageTag, BaseDamage);                               │
│                                                                 │
│     // 应用伤害GE到目标                                           │
│     TargetASC->ApplyGameplayEffectSpecToTarget(DamageSpec);     │
│ }                                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤5：目标ASC处理伤害GE                                         │
│                                                                 │
│ 目标的ASC收到伤害GE Spec后：                                     │
│                                                                 │
│ ① 检查标签条件：目标有 State.Invincible 吗？                     │
│    → 没有，继续                                                  │
│                                                                 │
│ ② 执行Modifier计算：Health -= 伤害值                             │
│    → 当前Health从 100 → 55                                      │
│                                                                 │
│ ③ 触发GameplayCue：播放受击特效、音效、屏幕震动                   │
│                                                                 │
│ ④ 触发PostGameplayEffectExecute回调：                            │
│    → AttributeSet检查Health是否<=0                               │
│    → 如果Health<=0，表示角色死亡                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 步骤6：技能结束 (EndAbility)                                      │
│                                                                 │
│ EndAbility() 中：                                                │
│  ASC::RemoveLooseGameplayTag(State.Combat.Casting)              │
│  → 移除"施法中"状态标签，角色恢复移动能力                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## GAS的依赖和启用

### 需要的模块

GAS位于`GameplayAbilities`模块中。在你的`.Build.cs`文件中：

```cpp
// YourGame.Build.cs
using UnrealBuildTool;

public class MyGame : ModuleRules
{
    public MyGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        // 公开依赖：使用这些模块的类会被暴露给其他模块
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",

            // ===== GAS相关模块 =====
            "GameplayAbilities",   // GAS核心：GA、GE、ASC、AttributeSet
            "GameplayTags",        // GameplayTag系统
            "GameplayTasks",       // 技能异步任务（如等待延迟、等待事件）
        });

        // 私有依赖：只在模块内部使用
        PrivateDependencyModuleNames.AddRange(new string[]
        {
            // 根据需要添加
        });
    }
}
```

### 插件启用

GAS需要启用以下插件（编辑器菜单：Edit → Plugins）：

| 插件名                  | 是否必须 | 说明                          |
| ----------------------- | -------- | ----------------------------- |
| **Gameplay Abilities**  | ✅ 必须  | GAS的核心插件                 |
| **GameplayTags Editor** | ✅ 推荐  | 在编辑器中管理GameplayTag的UI |

### ⚠️ 常见错误

```cpp
// ❌ 错误1：忘记在Build.cs中添加GameplayAbilities模块
// 结果：编译时找不到UGameplayAbility等类
// 编译器报错: undefined reference to `UGameplayAbility`

// ❌ 错误2：添加了模块但使用了错误的依赖类型
PublicDependencyModuleNames.Add("GameplayAbilities");
// 正确 -- 但还需确认。如果其他模块不需要访问你的GAS类，用Private即可

// ❌ 错误3：忘记添加GameplayTags模块
// GAS内部强烈依赖GameplayTag，即使是简单的属性修改也可能需要标签匹配
```

---

## 适用和不适用GAS的游戏类型

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GAS适用性分析                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ 非常适合使用GAS的游戏类型：                                       │
│                                                                     │
│  🎮 RPG（角色扮演）         ┌──────────────────────┐                │
│  🎮 ARPG（动作RPG）         │ 复杂的属性系统        │                │
│  🎮 MOBA（多人在线竞技）    │ 大量的技能和Buff       │                │
│  🎮 MMO（大型多人在线）     │ 需要网络同步           │                │
│  🎮 射击游戏（技能型）      │ 状态机逻辑复杂         │                │
│  🎮 动作游戏               │ 需要数据驱动           │                │
│  🎮 卡牌游戏               └──────────────────────┘                │
│                                                                     │
│  判断标准：你的游戏是否有以下特征？                                    │
│  ☑ 角色有多种数值属性（血、蓝、攻击力等）                              │
│  ☑ 技能之间有复杂的牵制关系（打断、免疫、条件）                         │
│  ☑ 需要Buff/Debuff系统（持续效果）                                    │
│  ☑ 是多人游戏（需要网络同步）                                         │
│  ☑ 策划需要频繁调整数值（数据驱动需求）                                │
│  → 满足2个以上，强烈建议使用GAS                                      │
│                                                                     │
│ ──────────────────────────────────────────────────────────────     │
│                                                                     │
│  ❌ 不太适合使用GAS的游戏类型：                                       │
│                                                                     │
│  • 纯物理模拟游戏（如解谜游戏）                                       │
│  • 极其简单的游戏（如Flappy Bird级别）                                │
│  • 不需要技能系统的叙事游戏                                           │
│  • 纯粹的步行模拟器                                                   │
│                                                                     │
│  原因：GAS有学习成本和运行时开销，简单的游戏不需要这么重的框架          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 关于GAS的常见误区

```
❌ 误区1："GAS只能做战斗技能"
   ✅ 事实：GAS可以做任何事情——跳跃、冲刺、交互、对话、背包系统...
   只要是需要"条件判断+执行逻辑+状态管理"的系统，都可以用GAS。

❌ 误区2："GAS太重了，不适合小项目"
   ✅ 事实：GAS的开销主要在开发时的学习成本，运行时非常高效。
   即使是小项目，如果你的核心玩法涉及技能和属性，GAS反而能加速开发。

❌ 误区3："GAS必须配合蓝图使用"
   ✅ 事实：GAS的C++ API非常完善，完全可以用纯C++。
   蓝图是可选的便捷补充，不是必须。

❌ 误区4："GAS只能做定量的数值修改"
   ✅ 事实：通过Custom Calculation Class（MMC），你可以实现任何复杂的计算。
   包括根据距离计算伤害衰减、根据连击数加成伤害等。

❌ 误区5："学了GAS就能无视网络编程"
   ✅ 事实：GAS解决了大部分网络同步问题，但你还是需要理解网络基础。
   比如RPC、Replicated属性、服务器权威等概念仍然是必要的。
```

---

## 本章核心概念速查

| 组件    | 英文全称               | 一句话解释                     |
| ------- | ---------------------- | ------------------------------ |
| **ASC** | AbilitySystemComponent | 大脑/调度中心，管理所有GAS功能 |
| **GA**  | GameplayAbility        | 技能的"蓝图"，定义技能做什么   |
| **GE**  | GameplayEffect         | 效果的"配方"，定义属性怎么改   |
| **GT**  | GameplayTag            | 层级标签，标记状态和条件       |
| **AS**  | AttributeSet           | 属性集合，存储角色的数值属性   |
| **GC**  | GameplayCue            | 表现层，播放特效/音效/动画     |

---

## 完成检查清单

阅读完本章后，你应该能回答以下问题。如果不能，请回读相关小节：

- [ ] 你能说出GAS解决的六大问题是什么吗？
- [ ] 你能画出GAS六大组件的关系图吗？
- [ ] 你能描述一个技能在GAS中的完整执行流程吗？
- [ ] 你知道在Build.cs中需要添加哪些GAS相关模块吗？
- [ ] 你能区分哪些游戏适合用GAS、哪些不适合吗？
- [ ] 你理解"数据驱动"在GAS中具体是指什么吗？
- [ ] 你能列举GAS的五个常见误区吗？

---

> **下一节**：[13.2 AbilitySystemComponent](./02-AbilitySystemComponent.md) — 深入GAS的大脑核心
