# 13.5 GameplayTag (GT)

> **目标**：深入理解GameplayTag的层级设计、实用技巧和最佳实践。掌握标签的创建、使用和查询。

---

## GameplayTag是什么

```
┌───────────────────────────────────────────────────────────────────┐
│           GameplayTag = 层级化的字符串标签系统                       │
│                                                                     │
│  GameplayTag 本质上是一个 FName（高效查找的字符串ID）               │
│  但它被设计成层级结构，支持高效的父级匹配查询                        │
│                                                                     │
│  标签格式: "Parent.Child.GrandChild.GreatGrandChild"               │
│                                                                     │
│  示例:                                                              │
│  State.CC.Stun                   ← 4层                              │
│  Ability.Element.Fire.Magic      ← 4层                              │
│  Buff.Offensive.AttackUp         ← 3层                              │
│                                                                     │
│  层级匹配的核心能力:                                                 │
│  查询 State.CC 会匹配: State.CC, State.CC.Stun, State.CC.Root ...  │
│  查询 State.CC.Stun 只匹配: State.CC.Stun (精确)                   │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 为什么用GameplayTag而不是bool或Enum？

这是GAS设计中最深刻的思想之一。让我们逐步理解。

### 问题演进

```
步骤1：用bool变量 → 太死板
┌───────────────────────────────────────────────────────────────────┐
│  class AMyCharacter                                                │
│  {                                                                 │
│      bool bIsStunned = false;                                      │
│      bool bIsRooted = false;                                       │
│      bool bIsSilenced = false;                                     │
│      bool bIsDisarmed = false;                                     │
│      bool bIsInvincible = false;                                   │
│      bool bIsCasting = false;                                     │
│      bool bIsDead = false;                                        │
│      bool bIsFlying = false;                                      │
│                                                                     │
│      // 问题1: 每加一个新状态就要改类声明                            │
│      // 问题2: "能否释放技能" = !bIsStunned && !bIsRooted && ...   │
│      //        每加一个控制效果都要更新这个判断！                    │
│      // 问题3: 多个地方写了类似的bool组合判断，容易遗漏             │
│  };                                                                │
└───────────────────────────────────────────────────────────────────┘
                               ↓ 改进
步骤2：用Enum位掩码 → 灵活了一些，但仍然局限
┌───────────────────────────────────────────────────────────────────┐
│  enum class ECharacterState : uint32                               │
│  {                                                                 │
│      None        = 0,                                              │
│      Stunned     = 1 << 0,                                         │
│      Rooted      = 1 << 1,                                         │
│      Silenced    = 1 << 2,                                         │
│      Disarmed    = 1 << 3,                                         │
│      Invincible  = 1 << 4,                                         │
│      Dead        = 1 << 5                                          │
│      // 最多64种状态（uint64)                                      │
│  };                                                                │
│                                                                     │
│  // 问题1: 依然是编译期确定的 —— 改枚举要重新编译                  │
│  // 问题2: 不能分组 —— "所有控制效果"不能直接表达                  │
│  // 问题3: 不能"携带数据" —— "眩晕"的持续时间不是枚举的一部分      │
│  // 问题4: 模块间依赖 —— 枚举定义在Core，所有模块都要依赖它       │
└───────────────────────────────────────────────────────────────────┘
                               ↓ 终极方案
步骤3：GameplayTag —— 自由、灵活、数据驱动
┌───────────────────────────────────────────────────────────────────┐
│  State.CC.Stun         ← 眩晕                                     │
│  State.CC.Root         ← 定身                                     │
│  State.CC.Silence      ← 沉默                                     │
│  State.CC.Disarm       ← 缴械                                     │
│  State.Dead            ← 死亡                                     │
│  State.Combat.Casting  ← 施法中                                   │
│  State.Invincible      ← 无敌                                     │
│                                                                     │
│  // 查询"是否有任何控制效果"                                      │
│  HasTag(State.CC)  ← 一条语句匹配所有CC子标签！                    │
│                                                                     │
│  // 新增"恐惧"状态                                               │
│  只需添加 State.CC.Fear (数据层面，不用改代码)                      │
│  HasTag(State.CC) 自动包含 Fear！                                  │
│                                                                     │
│  // 查询"能否释放技能 "                                            │
│  !HasAny(State.CC, State.Dead) ← 简洁明了                         │
└───────────────────────────────────────────────────────────────────┘
```

---

## GameplayTag的数据结构

```cpp
// ===== FGameplayTag —— 单个标签 =====
// 本质是一个 FName（一个全局唯一、哈希索引的字符串）
// FName查找是O(1)，非常高效

FGameplayTag StunTag = FGameplayTag::RequestGameplayTag(
    FName("State.CC.Stun")
);

// ===== FGameplayTagContainer —— 标签容器 =====
// 本质是一个标签数组，但内部做了优化（排序+索引）
// 支持快速匹配查询

FGameplayTagContainer CC_Container;
CC_Container.AddTag(FGameplayTag::RequestGameplayTag(FName("State.CC.Stun")));
CC_Container.AddTag(FGameplayTag::RequestGameplayTag(FName("State.CC.Root")));
CC_Container.AddTag(FGameplayTag::RequestGameplayTag(FName("State.CC.Silence")));

// ===== FGameplayTagQuery —— 标签查询表达式 =====
// 支持复杂的布尔组合查询（AND, OR, NOT）
// 适合更复杂的标签条件逻辑
```

---

## 标签的层级匹配机制

这是GameplayTag最核心的特性。理解它需要仔细看下面的例子：

```
┌───────────────────────────────────────────────────────────────────┐
│                      层级匹配详解                                    │
│                                                                     │
│  假设已注册以下标签：                                               │
│  ┌───────────────────────────────────────────────────┐            │
│  │  State                                            │            │
│  │  ├── State.CC                                     │            │
│  │  │   ├── State.CC.Stun                            │            │
│  │  │   ├── State.CC.Root                            │            │
│  │  │   ├── State.CC.Silence                         │            │
│  │  │   └── State.CC.Fear                            │            │
│  │  ├── State.Dead                                   │            │
│  │  └── State.Combat                                 │            │
│  │      └── State.Combat.Casting                     │            │
│  └───────────────────────────────────────────────────┘            │
│                                                                     │
│  不同查询函数的行为：                                               │
│                                                                     │
│  假设角色身上有标签: State.CC.Stun                                  │
│                                                                     │
│  ┌──────────────────────────┬─────────────────────────────────┐   │
│  │  查询函数                 │  查询 State.CC 的结果            │   │
│  ├──────────────────────────┼─────────────────────────────────┤   │
│  │  HasTag(State.CC)        │  ✅ true  (严格匹配)              │   │
│  │                          │  注意：HasTag不检测子标签！       │   │
│  ├──────────────────────────┼─────────────────────────────────┤   │
│  │  HasTagExact(State.CC)   │  ❌ false (精确匹配，无此标签)    │   │
│  ├──────────────────────────┼─────────────────────────────────┤   │
│  │  HasTag(State.CC.Stun)   │  ✅ true                         │   │
│  ├──────────────────────────┼─────────────────────────────────┤   │
│  │  MatchesTag(State.CC)    │  ✅ true (检测且匹配子标签)       │   │
│  ├──────────────────────────┼─────────────────────────────────┤   │
│  │  MatchesTagExact(Stun)   │  ✅ true                         │   │
│  └──────────────────────────┴─────────────────────────────────┘   │
│                                                                     │
│  ⚠️ 常见的混淆点：                                                   │
│                                                                     │
│  HasTag        = 检查标签容器中是否有指定的确切标签                   │
│  MatchesTag    = 检查标签是否匹配（包括子标签的层级匹配）             │
│                                                                     │
│  对于 FGameplayTagContainer：                                       │
│  HasTag(State.CC)     → 容器中是否有 State.CC 这个确切标签          │
│  HasTagExact(Stun)    → 容器中是否有 State.CC.Stun 这个精确标签     │
│  HasAny(container)    → 容器中是否有任意一个container中的标签        │
│  HasAll(container)    → 容器中是否包含container中的所有标签          │
│                                                                     │
│  MatchesTag(State.CC)  → 容器中是否有 State.CC 或其子标签           │
│  MatchesTagExact(Stun) → 容器中是否有 State.CC.Stun 这个精确标签    │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### 匹配函数速查表

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    FGameplayTag / FGameplayTagContainer 匹配函数            │
│                                                                            │
│  FGameplayTag (单个标签) 的匹配函数：                                       │
│  ┌─────────────────────────┬────────────────────────────────────────────┐ │
│  │  MatchesTag(Tag)        │  此标签是否 == Tag (无层级匹配)            │ │
│  │  MatchesTagExact(Tag)   │  此标签是否 == Tag (同上，单个标签无层级)  │ │
│  │  MatchesAny(Tag, Tag2)  │  此标签是否匹配任意一个                     │ │
│  │  IsValid()              │  标签是否有效（被注册）                     │ │
│  │  RequestGameplayTag()   │  静态函数，请求一个标签（如果不存在就注册） │ │
│  │  GetTagName()           │  获取FName                                │ │
│  │  ToString()             │  获取string                               │ │
│  └─────────────────────────┴────────────────────────────────────────────┘ │
│                                                                            │
│  FGameplayTagContainer (标签容器) 的匹配函数：                              │
│  ┌─────────────────────────┬────────────────────────────────────────────┐ │
│  │  HasTag(Tag)            │  容器中是否有Tag这个确切标签（无层级匹配）  │ │
│  │  HasTagExact(Tag)       │  同上                                       │ │
│  │  HasAny(Container)      │  容器中是否有Container中的任意标签          │ │
│  │  HasAll(Container)      │  容器中是否包含Container中的所有标签        │ │
│  │  HasAnyExact(Container) │  HasAny的精确版本                          │ │
│  │  HasAllExact(Container) │  HasAll的精确版本                          │ │
│  │  MatchesTag(Tag)        │  层级匹配！本容器中是否有Tag或其子标签     │ │
│  │  MatchesTagExact(Tag)   │  精确匹配，本容器中是否有Tag               │ │
│  │  MatchesAny(Tag, Tag2)  │  层级匹配任意一个                           │ │
│  │  MatchesQuery(Query)    │  匹配复杂查询表达式                        │ │
│  │  IsEmpty()              │  容器是否为空                               │ │
│  │  Num()                  │  容器中的标签数量                           │ │
│  │  AddTag(Tag)            │  添加标签                                   │ │
│  │  RemoveTag(Tag)         │  移除标签                                   │ │
│  └─────────────────────────┴────────────────────────────────────────────┘ │
│                                                                            │
│  ⚠️ 关键差异：                                                              │
│  HasTag 系列：不进行层级匹配（检查容器中是否有精确的标签）                    │
│  MatchesTag 系列：进行层级匹配（标签层级匹配——子标签也匹配父查询）            │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 创建和使用GameplayTag

### 在编辑器中创建

```
┌─────────────────────────────────────────────────────────────────┐
│                   创建GameplayTag的步骤                            │
│                                                                   │
│  方法1：项目设置中创建（推荐）                                    │
│  1. 打开 Edit → Project Settings                                  │
│  2. 找到 GameplayTags 分类                                        │
│  3. 点击 "Add New Gameplay Tag"                                   │
│  4. 输入完整标签名，如 State.CC.Stun                             │
│  5. 可添加注释（Comment）                                         │
│  6. 可添加源文件引用（Source）                                    │
│                                                                   │
│  方法2：在 GameplayTag 资产文件中批量创建                         │
│  1. 内容浏览器右键 → Miscellaneous → Data Asset                  │
│  2. 选择 GameplayTagsManager → GameplayTagList                    │
│  3. 在资产中批量定义标签                                          │
│                                                                   │
│  方法3：在 DefaultGameplayTags.ini 配置文件中定义                 │
│  [/Script/GameplayTags.GameplayTagsManager]                       │
│  +GameplayTagList=(Tag="State.CC.Stun",DevComment="角色被眩晕")    │
│  +GameplayTagList=(Tag="State.Dead",DevComment="角色死亡")         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 在C++中使用

```cpp
// ===== 在C++代码中使用GameplayTag =====

#include "GameplayTagContainer.h"
#include "GameplayTagsManager.h"

// ===== 使用方式1：内联请求标签（简单场景）=====
void UseInlineTags()
{
    // 请求一个标签（如果不存在，会在GameplayTagsManager中注册）
    FGameplayTag StunTag = FGameplayTag::RequestGameplayTag(
        FName("State.CC.Stun")
    );

    // 检查是否有效（是否被成功注册）
    if (StunTag.IsValid())
    {
        UE_LOG(LogTemp, Log, TEXT("Tag is valid: %s"), *StunTag.ToString());
    }

    // 构建容器
    FGameplayTagContainer Container;
    Container.AddTag(StunTag);
    Container.AddTag(FGameplayTag::RequestGameplayTag(FName("State.Dead")));
}

// ===== 使用方式2：使用静态标签变量（推荐——性能最好）=====
// 在头文件中声明
UCLASS()
class UMyGameplayTags : public UObject
{
    GENERATED_BODY()

public:
    // 在类加载时初始化一次，之后直接使用FGameplayTag变量
    // 避免每次RequestGameplayTag的查找开销
    
    // 状态标签
    static FGameplayTag State_Dead;
    static FGameplayTag State_CC;
    static FGameplayTag State_CC_Stun;
    static FGameplayTag State_CC_Root;
    static FGameplayTag State_CC_Silence;
    static FGameplayTag State_Invincible;

    // 战斗标签
    static FGameplayTag Combat_Casting;
    static FGameplayTag Combat_InCombat;

    // 技能标签
    static FGameplayTag Ability_Type_Active;
    static FGameplayTag Ability_Element_Fire;

    // 初始化所有标签
    static void InitializeTags();
};

// 在cpp中实现
FGameplayTag UMyGameplayTags::State_Dead;
FGameplayTag UMyGameplayTags::State_CC;
FGameplayTag UMyGameplayTags::State_CC_Stun;
FGameplayTag UMyGameplayTags::State_CC_Root;
FGameplayTag UMyGameplayTags::State_CC_Silence;
FGameplayTag UMyGameplayTags::State_Invincible;
FGameplayTag UMyGameplayTags::Combat_Casting;
FGameplayTag UMyGameplayTags::Combat_InCombat;
FGameplayTag UMyGameplayTags::Ability_Type_Active;
FGameplayTag UMyGameplayTags::Ability_Element_Fire;

void UMyGameplayTags::InitializeTags()
{
    // 只执行一次（在模块启动或游戏开始时调用）
    static bool bInitialized = false;
    if (bInitialized) return;
    bInitialized = true;

    // 获取标签管理器
    UGameplayTagsManager& TagManager = UGameplayTagsManager::Get();

    // 批量添加标签
    TagManager.AddNativeGameplayTag(FName("State.Dead"));
    TagManager.AddNativeGameplayTag(FName("State.CC"));
    TagManager.AddNativeGameplayTag(FName("State.CC.Stun"));
    TagManager.AddNativeGameplayTag(FName("State.CC.Root"));
    TagManager.AddNativeGameplayTag(FName("State.CC.Silence"));
    TagManager.AddNativeGameplayTag(FName("State.Invincible"));
    TagManager.AddNativeGameplayTag(FName("State.Combat.Casting"));
    TagManager.AddNativeGameplayTag(FName("State.Combat.InCombat"));
    TagManager.AddNativeGameplayTag(FName("Ability.Type.Active"));
    TagManager.AddNativeGameplayTag(FName("Ability.Element.Fire"));

    // 缓存标签到静态变量
    State_Dead = FGameplayTag::RequestGameplayTag(FName("State.Dead"));
    State_CC = FGameplayTag::RequestGameplayTag(FName("State.CC"));
    State_CC_Stun = FGameplayTag::RequestGameplayTag(FName("State.CC.Stun"));
    State_CC_Root = FGameplayTag::RequestGameplayTag(FName("State.CC.Root"));
    State_CC_Silence = FGameplayTag::RequestGameplayTag(FName("State.CC.Silence"));
    State_Invincible = FGameplayTag::RequestGameplayTag(FName("State.Invincible"));
    Combat_Casting = FGameplayTag::RequestGameplayTag(FName("State.Combat.Casting"));
    Combat_InCombat = FGameplayTag::RequestGameplayTag(FName("State.Combat.InCombat"));
    Ability_Type_Active = FGameplayTag::RequestGameplayTag(FName("Ability.Type.Active"));
    Ability_Element_Fire = FGameplayTag::RequestGameplayTag(FName("Ability.Element.Fire"));
}

// ===== 使用静态标签（性能最优）=====
void UseStaticTags(UAbilitySystemComponent* ASC)
{
    // 直接使用缓存的标签，不需要每次查找
    if (ASC->HasMatchingGameplayTag(UMyGameplayTags::State_CC_Stun))
    {
        // 角色被眩晕
    }

    if (!ASC->HasAnyMatchingGameplayTags(
        FGameplayTagContainer(UMyGameplayTags::State_Dead)))
    {
        // 角色还活着
    }
}
```

---

## 标签在GAS各组件中的应用

```
┌───────────────────────────────────────────────────────────────────┐
│             GameplayTag 在GAS中无处不在                              │
│                                                                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. GA (GameplayAbility) 中的标签：                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Ability Tags              ← 这个技能有什么标签            │     │
│  │  CancelAbilitiesWithTag    ← 激活时取消哪些技能的标签      │     │
│  │  BlockAbilitiesWithTag     ← 激活期间阻止哪些技能的标签    │     │
│  │  ActivationOwnedTags       ← 激活时给ASC加哪些标签         │     │
│  │  ActivationRequiredTags    ← 需要哪些标签才能激活           │     │
│  │  ActivationBlockedTags     ← 有这些标签时不能激活           │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                     │
│  2. GE (GameplayEffect) 中的标签：                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Application Tag Requirements ← 目标需要/不需要的标签     │     │
│  │   - RequireTags: 目标必须有这些标签                      │     │
│  │   - IgnoreTags: 目标不能有这些标签                       │     │
│  │                                                           │     │
│  │  Ongoing Tag Requirements ← 持续期间的标签条件            │     │
│  │   - RequireTags: 持续期间必须有这些标签                   │     │
│  │   - Remove Tags When Inactive: 无这些标签时是否移除       │     │
│  │                                                           │     │
│  │  Remove Gameplay Effects with Tags ← 移除带标签的效果     │     │
│  │                                                           │     │
│  │  Granted Tags (Asset Tags + Dynamic Tags)                 │     │
│  │   - GE激活期间给目标添加的标签                             │     │
│  │   - 用于标记状态: State.Dead, State.CC.Stun等             │     │
│  │                                                           │     │
│  │  GameplayCue Tags ← 触发哪些表现效果                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                     │
│  3. ASC (AbilitySystemComponent) 中的标签：                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  GetOwnedGameplayTags()     ← 获取角色当前所有标签         │     │
│  │  HasMatchingGameplayTag()   ← 检查是否有特定标签           │     │
│  │  AddLooseGameplayTag()      ← 手动添加标签                 │     │
│  │  RemoveLooseGameplayTag()   ← 手动移除标签                 │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 标签的"授予(Grant)" vs "请求(Request)"机制

```
┌───────────────────────────────────────────────────────────────────┐
│              标签的授予和请求                                        │
│                                                                     │
│  两种方式让标签出现在ASC上：                                        │
│                                                                     │
│  方式1：GE授予标签（Granted Tags）—— 主要方式                       │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  通过GE的GrantedTags配置，在GE应用时自动添加标签     │          │
│  │                                                       │          │
│  │  示例：眩晕GE → 包含GrantedTag: State.CC.Stun        │          │
│  │         → 应用GE到目标 → 目标ASC自动获得眩晕标签      │          │
│  │         → GE到期/移除 → 标签自动消失                  │          │
│  │                                                       │          │
│  │  这是推荐的方式 — 标签的生命周期由GE管理              │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  方式2：手动添加松散标签（Loose Tags）—— 辅助方式                   │
│  ┌─────────────────────────────────────────────────────┐          │
│  │  通过ASC的AddLooseGameplayTag直接添加                │          │
│  │                                                       │          │
│  │  ASC->AddLooseGameplayTag(State_Dead);               │          │
│  │                                                       │          │
│  │  松散的 = 不属于任何GE                                │          │
│  │  必须手动移除：                                       │          │
│  │  ASC->RemoveLooseGameplayTag(State_Dead);            │          │
│  │                                                       │          │
│  │  使用场景：                                            │          │
│  │  - 代码逻辑驱动的状态（如关卡触发器）                  │          │
│  │  - 不需要时效的状态                                    │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 标签命名规范和最佳实践

```
┌───────────────────────────────────────────────────────────────────┐
│                    GameplayTag 命名规范                               │
│                                                                     │
│  推荐的顶级命名空间：                                                │
│                                                                     │
│  State.*          — 角色状态                                        │
│    State.CC.*     — 控制效果                                        │
│    State.Combat.* — 战斗相关状态                                    │
│    State.Movement.* — 移动状态                                      │
│    State.Dead     — 死亡                                            │
│                                                                     │
│  Ability.*        — 技能相关                                        │
│    Ability.Type.* — 技能类型（Active/Passive/Channel）              │
│    Ability.Element.* — 技能元素（Fire/Water/Ice/Thunder）           │
│                                                                     │
│  Cooldown.*       — 冷却相关                                        │
│    Cooldown.Skill.* — 技能冷却                                      │
│    Cooldown.Global — 全局冷却                                       │
│                                                                     │
│  Buff.*           — Buff标记                                        │
│    Buff.Offensive.* — 攻击性Buff                                   │
│    Buff.Defensive.* — 防御性Buff                                   │
│                                                                     │
│  Debuff.*         — Debuff标记                                      │
│    Debuff.DOT.*   — 持续伤害                                        │
│    Debuff.CC.*    — 控制效果                                        │
│                                                                     │
│  Event.*          — 事件标签（用于触发能力）                         │
│    Event.Damage.* — 伤害事件                                        │
│    Event.Death.*  — 死亡事件                                        │
│                                                                     │
│  Data.*           — 数据标签（用于SetByCaller）                      │
│    Data.Damage    — 伤害数据                                        │
│    Data.Healing   — 治疗数据                                        │
│    Data.Duration  — 持续时间数据                                    │
│                                                                     │
│  Cue.*            — GameplayCue表现标签                              │
│    Cue.Combat.*   — 战斗表现                                        │
│    Cue.UI.*       — UI表现                                          │
│                                                                     │
│  ─────────────────────────────────────────────────────────        │
│                                                                     │
│  命名规则：                                                          │
│  ✅ State.CC.Stun          — 清晰的层级结构                          │
│  ✅ State.CC.Root          — 每个名字表达具体的含义                   │
│  ✅ Ability.Element.Fire   — 使用点号分隔层级                        │
│                                                                     │
│  ❌ stunned                — 太简单，不知道是什么标签                │
│  ❌ CC_Stun                — 没有层级结构                            │
│  ❌ B_Stun                 — 缩写不清晰                              │
│  ❌ State-CC-Stun          — 用连字符而非点号                        │
│                                                                     │
│  最佳实践：                                                          │
│  1. 提前规划命名空间，不要边做边加                                   │
│  2. 建立标签文档，团队共享（哪些标签存在、它们的含义）               │
│  3. 先定义父级标签(State.CC)，再定义子级(State.CC.Stun)             │
│  4. 标签不属于任何模块，是项目全局的                                 │
│  5. 使用AddNativeGameplayTag在C++中注册"原生"标签                   │
│  6. 不要滥用标签——只有需要查询和匹配的状态才用标签                   │
│  7. 标签是FName —— 不要每帧动态创建新标签                            │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## FGameplayTagQuery —— 复杂标签查询

```cpp
// ===== 使用FGameplayTagQuery进行复杂的组合条件查询 =====

void UseTagQuery(UAbilitySystemComponent* ASC)
{
    // 构建一个查询表达式：
    // 角色必须 (有 State.Combat.InCombat) 且 (没有 State.Dead 且没有 State.CC)
    
    FGameplayTagQuery Query = FGameplayTagQuery::BuildQuery(
        FGameplayTagQueryExpression()
            .AllTagsMatch()                           // 所有条件都要满足
            .AddTag(UMyGameplayTags::Combat_InCombat) // 必须在战斗中
            .AddExpression(                           // 嵌套表达式
                FGameplayTagQueryExpression()
                    .NoTagsMatch()                     // 不能有这些标签
                    .AddTag(UMyGameplayTags::State_Dead)
                    .AddTag(UMyGameplayTags::State_CC) // 不能有任何控制效果
            )
    );

    // 使用查询检查ASC标签
    if (ASC->GetOwnedGameplayTags().MatchesQuery(Query))
    {
        // 角色在战斗中，没有死亡，没有被控制
        // 可以执行需要"战斗状态+不受控制"的技能
    }

    // 简化写法示例：只需要有任意一个标签
    FGameplayTagQuery SimpleQuery = FGameplayTagQuery::BuildQuery(
        FGameplayTagQueryExpression()
            .AnyTagsMatch()
            .AddTag(UMyGameplayTags::State_CC_Stun)
            .AddTag(UMyGameplayTags::State_CC_Root)
    );
}
```

---

## 标签的调试技巧

```cpp
// ===== 调试用函数 =====

void DebugPrintAllTags(UAbilitySystemComponent* ASC)
{
    if (!ASC) return;

    // 获取ASC上所有当前激活的标签
    FGameplayTagContainer AllTags;
    ASC->GetOwnedGameplayTags(AllTags);

    UE_LOG(LogTemp, Warning, TEXT("=== 角色当前标签（共%d个）==="), AllTags.Num());
    
    for (const FGameplayTag& Tag : AllTags)
    {
        UE_LOG(LogTemp, Warning, TEXT("  [%s]"), *Tag.ToString());
    }

    // 按条件分类打印
    UE_LOG(LogTemp, Warning, TEXT("--- 控制效果 ---"));
    for (const FGameplayTag& Tag : AllTags)
    {
        if (Tag.MatchesTag(UMyGameplayTags::State_CC))
        {
            UE_LOG(LogTemp, Warning, TEXT("  %s"), *Tag.ToString());
        }
    }
}

// ===== 列出项目中所有已注册的标签 =====
void ListAllRegisteredTags()
{
    UGameplayTagsManager& TagManager = UGameplayTagsManager::Get();
    
    TArray<FGameplayTag> AllTags;
    TagManager.RequestAllGameplayTags(AllTags);

    UE_LOG(LogTemp, Warning, TEXT("=== 所有已注册标签（共%d个）==="), AllTags.Num());
    
    for (const FGameplayTag& Tag : AllTags)
    {
        UE_LOG(LogTemp, Warning, TEXT("  %s"), *Tag.ToString());
    }
}
```

---

## ✅ 正确做法 vs ❌ 错误做法

```cpp
// ===== 标签使用的正确和错误方式 =====

// ✅ 正确：使用静态变量缓存标签（性能最优）
static FGameplayTag StunTag = FGameplayTag::RequestGameplayTag(FName("State.CC.Stun"));
if (ASC->HasMatchingGameplayTag(StunTag)) { ... }

// ❌ 错误：每次调用都重新Request（每次都要查表）
if (ASC->HasMatchingGameplayTag(
    FGameplayTag::RequestGameplayTag(FName("State.CC.Stun"))))
{
    // 虽然能工作，但每帧这样调用浪费性能
}

// ✅ 正确：用层级标签做宽泛匹配
// 判断"是否有任何控制效果"
if (ASC->HasMatchingGameplayTag(UMyGameplayTags::State_CC)) { ... }

// ❌ 错误：用多个精确标签实现同样的效果
if (ASC->HasMatchingGameplayTag(StunTag) || 
    ASC->HasMatchingGameplayTag(RootTag) || 
    ASC->HasMatchingGameplayTag(FearTag) ||
    ASC->HasMatchingGameplayTag(SilenceTag))
{
    // 每次新增控制类型都要改这个判断！
}

// ✅ 正确：使用FGameplayTagContainer做集合查询
FGameplayTagContainer BlockTags;
BlockTags.AddTag(State_Dead);
BlockTags.AddTag(State_CC_Stun);
BlockTags.AddTag(State_Invincible);
if (ASC->HasAnyMatchingGameplayTags(BlockTags)) { ... }

// ❌ 错误：用if-else链
if (ASC->HasMatchingGameplayTag(State_Dead)) { ... }
else if (ASC->HasMatchingGameplayTag(State_CC_Stun)) { ... }
else if (ASC->HasMatchingGameplayTag(State_Invincible)) { ... }
```

---

## 完成检查清单

- [ ] 你能说出为什么用GameplayTag而不是bool或Enum吗？
- [ ] 你理解层级匹配机制吗（HasTag vs MatchesTag的区别）？
- [ ] 你能在C++中创建和使用GameplayTag吗？
- [ ] 你知道如何用静态变量缓存标签以提升性能吗？
- [ ] 你理解GE的Granted Tags和手动AddLooseGameplayTag的区别吗？
- [ ] 你能说出GA中使用的六种标签配置吗？
- [ ] 你掌握了推荐的标签命名规范吗？
- [ ] 你能写出FGameplayTagQuery的复杂查询吗？

---

> **下一节**：[13.6 AttributeSet](./06-AttributeSet.md) — 深入属性集的定义和属性变化回调
