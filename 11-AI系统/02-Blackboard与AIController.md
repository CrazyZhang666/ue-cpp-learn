# 11.2 Blackboard与AIController：AI的"记忆"和"大脑"

> **目标**：掌握Blackboard（AI共享内存）的使用方法，理解AIController的核心API，并初步了解AI感知系统。

---

## 第一部分：Blackboard —— AI的"共享内存"

### 什么是Blackboard？

想象教室里的**黑板**：老师在上面写"今天的作业是XXX"，所有学生都能看到。UE的Blackboard就是这个概念，它是行为树中所有节点共享的**键值对存储空间**。

```
┌─────────────────────────────────────────────┐
│              Blackboard（黑板）               │
│                                             │
│   Key: "TargetActor"    Value: <玩家Pawn>  │  ← Task读取，去追击
│   Key: "TargetLocation" Value: (100,200,0) │  ← Task读取，移动过去
│   Key: "IsInCombat"     Value: true        │  ← Decorator读取，切换分支
│   Key: "HealthPercent"  Value: 0.75        │  ← Decorator读取，判断是否逃跑
│   Key: "AmmoCount"      Value: 30          │  ← Task读取，决定用哪种攻击
│   Key: "PatrolIndex"    Value: 2           │  ← Task读取，去第2个巡逻点
│                                             │
│   Service写入数据 ↑  │  ↓ Task/Decorator读取数据 │
│                     │                         │
│   [Service: 更新    │   [Decorator:           │
│    玩家位置到黑板]   │    TargetActor != null?] │
└─────────────────────────────────────────────┘
```

> **记住一句话**：Service往黑板**写**数据，Decorator从黑板**读**数据做判断，Task从黑板**读**数据执行行为。

---

### Blackboard的Key类型

Blackboard中的每个"Key"都有确定的类型。你需要在创建Blackboard资产时预先定义：

| Key类型    | 存储的数据      | 用途举例                      |
| ---------- | --------------- | ----------------------------- |
| **Bool**   | true / false    | "IsInCombat"（是否在战斗中）  |
| **Int**    | 整数            | "PatrolIndex"（巡逻点索引）   |
| **Float**  | 浮点数          | "HealthPercent"（血量百分比） |
| **String** | 字符串          | "CurrentStateName"（调试用）  |
| **Vector** | (X, Y, Z) 坐标  | "TargetLocation"（目标位置）  |
| **Object** | 任何UObject指针 | "TargetActor"（目标Actor）    |
| **Enum**   | 枚举值          | "AIState"（AI状态枚举）       |
| **Class**  | UClass类型      | "EnemyClass"（敌人类）        |

### 在编辑器中创建Blackboard

```
步骤1: 创建Blackboard资产
  Content Browser（内容浏览器）
    → 右键
    → Artificial Intelligence（人工智能）
    → Blackboard
    → 命名：BB_Monster

步骤2: 打开Blackboard，添加Key
  点击 "New Key" 按钮
    → 选择类型（比如 Object）
    → 命名为 "TargetActor"
    → 重复添加你需要的所有Key

步骤3: 关联到行为树
  打开你的 Behavior Tree 资产
    → 右侧 Details 面板
    → Behavior Tree 分类
    → Blackboard Asset：选择 BB_Monster
```

### Blackboard中的Key命名规范

```
✅ 推荐的命名规范：
  TargetActor          ← 目标Actor（Object类型）
  TargetLocation       ← 目标位置（Vector类型）
  IsInCombat           ← 是否战斗（Bool类型，Is前缀）
  bHasEnemySighted     ← 是否看到敌人（Bool类型，b前缀）
  PatrolIndex          ← 巡逻索引（Int类型）
  HomeLocation         ← 初始位置（Vector类型）
  MoveToLocation       ← 移动目标位置（Vector类型）

❌ 不推荐的命名：
  enemy                ← 全小写，不够明确
  pos                  ← 太短，不知道是什么位置
  flag1                ← 无意义的名字
  IsTheTargetAvailable ← 太啰嗦
```

---

## 第二部分：在C++中操作Blackboard

### 获取Blackboard组件

```cpp
// 在AIController或任何可以访问AIController的地方：

// 步骤1: 获取AIController
AAIController* AIController = Cast<AAIController>(GetController());
if (!AIController)
{
    return;  // AI控制器不存在，无法继续
}

// 步骤2: 从AIController获取Blackboard组件
UBlackboardComponent* Blackboard = AIController->GetBlackboardComponent();
if (!Blackboard)
{
    return;  // 黑板组件未初始化，可能是行为树还没启动
}
```

> **关键**：`GetBlackboardComponent()` 返回的是 `UBlackboardComponent*`，它是 `UActorComponent` 的子类，挂在AIController上。

### 写入数据到Blackboard（SetValueAsXXX）

Blackboard提供了类型安全的 `SetValueAsXXX` 系列函数：

```cpp
// 假设已经拿到了 UBlackboardComponent* Blackboard

// --- 写入Bool ---
// SetValueAsBool(黑板Key名, 值);
Blackboard->SetValueAsBool(TEXT("IsInCombat"), true);
// TEXT("IsInCombat")  ← 必须是Blackboard资产中已经定义过的Key名
// true                ← 要写入的布尔值

// --- 写入Int ---
Blackboard->SetValueAsInt(TEXT("PatrolIndex"), 2);
// 让AI去第3个巡逻点（索引从0开始）

// --- 写入Float ---
Blackboard->SetValueAsFloat(TEXT("HealthPercent"), 0.75f);
// 血量75%

// --- 写入Vector（位置/方向）---
FVector TargetPos(1000.0f, 500.0f, 0.0f);    // 目标位置 (X=1000, Y=500, Z=0)
Blackboard->SetValueAsVector(TEXT("TargetLocation"), TargetPos);

// --- 写入Object（Actor引用）---
AActor* Player = GetWorld()->GetFirstPlayerController()->GetPawn();
Blackboard->SetValueAsObject(TEXT("TargetActor"), Player);
// 黑板中的 TargetActor Key 现在指向玩家Pawn

// --- 写入String ---
Blackboard->SetValueAsString(TEXT("CurrentState"), TEXT("Chasing"));
// 调试查看AI当前状态

// --- 写入Enum ---
// 需要先在项目中定义EAIState枚举，并在Blackboard中创建对应Key
Blackboard->SetValueAsEnum(TEXT("AIState"), static_cast<uint8>(EAIState::Attacking));
// 枚举在Blackboard中存储为uint8
```

### 从Blackboard读取数据（GetValueAsXXX）

```cpp
// --- 读取Bool ---
bool bIsInCombat = Blackboard->GetValueAsBool(TEXT("IsInCombat"));
// ⚠️ 注意：如果Key名在Blackboard中不存在，会触发断言（Assert），导致编辑器崩溃！
// ⚠️ 因此必须确保Key名拼写正确！

// --- 读取Int ---
int32 PatrolIndex = Blackboard->GetValueAsInt(TEXT("PatrolIndex"));

// --- 读取Float ---
float Health = Blackboard->GetValueAsFloat(TEXT("HealthPercent"));

// --- 读取Vector ---
FVector TargetPos = Blackboard->GetValueAsVector(TEXT("TargetLocation"));

// --- 读取Object（需要Cast到具体类型）---
AActor* TargetActor = Cast<AActor>(
    Blackboard->GetValueAsObject(TEXT("TargetActor"))
);
// GetValueAsObject返回UObject*，需要用Cast转换为具体类型

// --- 读取String ---
FString CurrentState = Blackboard->GetValueAsString(TEXT("CurrentState"));

// --- 读取Enum ---
uint8 RawEnum = Blackboard->GetValueAsEnum(TEXT("AIState"));
EAIState State = static_cast<EAIState>(RawEnum);
```

### Blackboard Key的安全检查

```cpp
// ✅ 正确做法：使用前检查Key是否存在
UBlackboardComponent* BB = GetBlackboardComponent();
if (!BB) return;  // 先检查黑板是否存在

// 检查Key是否在这个Blackboard中定义过
FName KeyName = TEXT("TargetActor");
if (BB->IsValidKey(KeyName))  // 如果Key存在...
{
    AActor* Target = Cast<AActor>(BB->GetValueAsObject(KeyName));
    // ...安全地使用数据
}
else
{
    // ❌ Key名拼错了或没有在Blackboard资产中定义
    UE_LOG(LogTemp, Error, TEXT("Blackboard中不存在Key: %s"), *KeyName.ToString());
}
```

### ClearValue：清空某个Key

```cpp
// 清空某个Key的值，恢复到默认状态
Blackboard->ClearValue(TEXT("TargetActor"));
// 之后获取会得到nullptr（Object类型）或0（数值类型）或false（Bool类型）
```

---

## 第三部分：AIController —— AI的"大脑"

### AIController在继承链中的位置

```
Controller（控制器基类——控制Pawn的大脑）
├── APlayerController（玩家控制器——接收玩家输入）
└── AAIController（AI控制器——由行为树驱动）
    └── AMonsterAIController（你自己创建的AI控制器子类）
```

> **核心理解**：Controller是"大脑"，Pawn是"身体"。玩家的大脑是PlayerController（响应键盘鼠标），AI的大脑是AIController（响应行为树）。

### 创建自定义AIController

```cpp
// MonsterAIController.h
#pragma once

#include "CoreMinimal.h"
#include "AIController.h"                    // AAIController的头文件
#include "MonsterAIController.generated.h"   // ⚠️ 必须最后一个include！

/**
 * 怪物AI控制器
 * 职责：管理行为树、黑板、AI感知
 */
UCLASS()
class MYGAME_API AMonsterAIController : public AAIController
{
    GENERATED_BODY()  // UE反射系统必需的宏

public:
    // 构造函数——在这里设置AI的基础配置
    AMonsterAIController();

protected:
    // BeginPlay：游戏开始时调用，初始化AI系统
    virtual void BeginPlay() override;

    // OnPossess：当这个控制器"占领"一个Pawn时调用
    // 这是启动行为树的最佳时机！
    virtual void OnPossess(APawn* InPawn) override;

    // OnUnPossess：当控制器不再控制Pawn时调用（AI死亡等）
    virtual void OnUnPossess() override;

    // --- 行为树相关成员变量 ---
    // UPROPERTY(EditAnywhere) 让策划可以在编辑器中指定行为树资产
    // 而不需要硬编码路径
    UPROPERTY(EditDefaultsOnly, Category = "AI")
    class UBehaviorTree* BehaviorTreeAsset;
    // EditDefaultsOnly：只能在蓝图类默认值中编辑，运行时不可改
    // Category = "AI"：在编辑器中归到"AI"分类下

    // --- 行为树组件相关 ---
    // AAIController已经内置了这些组件，不需要手动创建
    // UBehaviorTreeComponent*  ← 继承自AAIController::GetBrainComponent()
    // UBlackboardComponent*    ← 继承自AAIController::GetBlackboardComponent()
};
```

```cpp
// MonsterAIController.cpp
#include "MonsterAIController.h"
#include "BehaviorTree/BehaviorTree.h"               // 行为树资产
#include "BehaviorTree/BlackboardComponent.h"        // 黑板组件
#include "BehaviorTree/BehaviorTreeComponent.h"      // 行为树组件
#include "Perception/AIPerceptionComponent.h"        // AI感知组件
#include "Perception/AISenseConfig_Sight.h"           // 视觉感知配置

// 构造函数
AMonsterAIController::AMonsterAIController()
{
    // 设置行为树组件在Tick时自动更新
    // PrimaryActorTick.bCanEverTick 在AAIController中默认可能为false
    // 但对于某些需要手动Tick的逻辑，可以设置为true
    PrimaryActorTick.bCanEverTick = true;
}

void AMonsterAIController::BeginPlay()
{
    // 调用父类的BeginPlay（必须！）
    Super::BeginPlay();

    // 如果在蓝图中设置了行为树资产，就在这里不做特别的初始化
    // 行为树的启动会在 OnPossess 中进行
}

void AMonsterAIController::OnPossess(APawn* InPawn)
{
    // 先调用父类的OnPossess——让AAIController完成基础初始化
    Super::OnPossess(InPawn);

    // 检查是否在蓝图中配置了行为树资产
    if (BehaviorTreeAsset != nullptr)
    {
        // 方法1：使用RunBehaviorTree启动行为树（推荐，最简单）
        // 这个函数会自动初始化Blackboard和BehaviorTreeComponent
        RunBehaviorTree(BehaviorTreeAsset);

        // ⚠️ RunBehaviorTree内部做了以下事情：
        // 1. 如果关联了Blackboard资产，自动创建/初始化UBlackboardComponent
        // 2. 启动UBehaviorTreeComponent
        // 3. 开始从Root节点每帧执行行为树

        UE_LOG(LogTemp, Log, TEXT("行为树已启动，AI正在思考..."));
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("⚠️ 未设置行为树资产！AI不会执行任何行为。"));
    }
}

void AMonsterAIController::OnUnPossess()
{
    // 停止行为树运行
    // RunBehaviorTree启动的行为树会自动在OnUnPossess时清理
    // 但如果有额外的清理逻辑，写在这里

    Super::OnUnPossess();
}
```

### RunBehaviorTree 详解

```cpp
// RunBehaviorTree是启动行为树的推荐方式
// 函数签名：
// void AAIController::RunBehaviorTree(UBehaviorTree* BTAsset);

// ✅ 正确做法：
void AMonsterAIController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);

    // 方式1: 使用蓝图设置的资产
    if (BehaviorTreeAsset)
    {
        RunBehaviorTree(BehaviorTreeAsset);
    }

    // 方式2: 使用硬编码路径（不推荐，策划不能换行为树）
    // UBehaviorTree* BT = LoadObject<UBehaviorTree>(
    //     nullptr,
    //     TEXT("/Game/AI/BT_Monster")
    // );
    // if (BT) RunBehaviorTree(BT);
}

// ❌ 错误做法：在构造函数中启动行为树
AMonsterAIController::AMonsterAIController()
{
    // RunBehaviorTree(XXX);  ← 错误！此时还没有Pawn，组件未初始化
}
```

### 控制Pawn移动的API

AIController提供了专门用于AI移动的函数：

```cpp
// --- MoveTo系列：让AI移动到目标位置/Actor ---

// 最简单：移动到某个Actor（自动跟随移动中的Actor）
AActor* Target = /* ... */;
EPathFollowingRequestResult::Type Result = MoveToActor(
    Target,            // 目标Actor
    100.0f,            // 可接受半径（距离目标100cm以内就算到达）
    true,              // bStopOnOverlap？重叠时停止？
    true,              // bUsePathfinding？使用寻路？
    false,             // bCanStrafe？可以侧移？
    nullptr,           // FilterClass？导航过滤器类
    false              // bAllowPartialPath？允许部分路径？
);

// 移动到某个位置（世界坐标）
FVector TargetLocation(1000.0f, 500.0f, 0.0f);
MoveToLocation(
    TargetLocation,    // 目标位置
    50.0f,             // 可接受半径
    true,              // bStopOnOverlap
    true,              // bUsePathfinding
    false,             // bProjectDestinationToNavigation（投影到导航网格）
    false,             // bCanStrafe
    nullptr,           // FilterClass
    false              // bAllowPartialPath
);

// --- 停止移动 ---
StopMovement();  // 立即停止当前的移动

// --- 查询移动状态 ---
EPathFollowingStatus::Type Status = GetMoveStatus();
// 返回值：
//   Idle      ← 没有在移动
//   Waiting   ← 等待寻路计算完成
//   Paused    ← 移动被暂停
//   Moving    ← 正在移动

// --- 移动完成回调 ---
// 可以绑定委托来监听移动完成：
// AITask_MoveTo 返回的Task上有 OnRequestFinished 委托
```

### 设置AI的朝向

```cpp
// --- 让AI面向某个位置 ---
FVector LookAtPoint(1000.0f, 0.0f, 0.0f);
SetFocus(LookAtPoint);  // 让AI平滑地转向看向这个位置

// --- 让AI面向某个Actor ---
AActor* TargetActor = /* ... */;
SetFocus(TargetActor);  // AI会持续看向这个Actor

// --- 清除焦点（不再盯着任何东西）---
ClearFocus(EAIFocusPriority::Gameplay);
```

---

## 第四部分：AI感知系统（AIPerception）简介

### 什么是AIPerception？

AI感知系统让AI能够"看"到玩家、"听"到脚步声、"感知"到伤害来源。它通过**感知组件（AIPerceptionComponent）**工作。

```
┌──────────────────────────────────────────────────┐
│                 AI感知系统架构                      │
│                                                  │
│  AAIController                                   │
│  ├── AIPerceptionComponent（感知组件）             │
│  │   ├── AISenseConfig_Sight（视觉配置）           │
│  │   │   ├── 视野半径：2000cm (20米)              │
│  │   │   ├── 视野半角：60°（前方120°锥形）         │
│  │   │   └── 检测类型：仅敌人                    │
│  │   ├── AISenseConfig_Hearing（听觉配置）         │
│  │   │   ├── 听觉半径：1500cm (15米)              │
│  │   │   └── 检测类型：脚步声、枪声              │
│  │   └── AISenseConfig_Damage（伤害感知配置）      │
│  │       └── 自动感知伤害来源                     │
│  └── ...                                         │
└──────────────────────────────────────────────────┘
```

### AI感知的基本概念

| 概念                          | 解释                                             |
| ----------------------------- | ------------------------------------------------ |
| **AIPerceptionComponent**     | 挂在AIController上的组件，管理所有感官           |
| **AISense**                   | 一种具体的感官类型（视觉、听觉、伤害）           |
| **AISenseConfig**             | 感官的配置参数（范围、角度等）                   |
| **AIPerceptionStimuliSource** | 挂在被感知的对象上（如玩家），标记"我能被感知"   |
| **Stimulus（刺激）**          | 一次具体的感知事件（"玩家跑过去了"、"枪声响了"） |

### 最常用的感知：视觉（Sight）

```cpp
// 在AIController中配置AI视觉感知：

void AMonsterAIController::BeginPlay()
{
    Super::BeginPlay();

    // 获取或创建感知组件（AAIController可能已经自带了一个）
    UAIPerceptionComponent* PerceptionComp = GetAIPerceptionComponent();
    if (!PerceptionComp)
    {
        // 如果没有，需要手动创建
        PerceptionComp = CreateDefaultSubobject<UAIPerceptionComponent>(
            TEXT("PerceptionComponent")
        );
    }

    // 创建视觉感知配置
    UAISenseConfig_Sight* SightConfig = CreateDefaultSubobject<UAISenseConfig_Sight>(
        TEXT("SightConfig")
    );

    // 配置视觉参数
    SightConfig->SightRadius = 1500.0f;       // 能看到的最远距离（15米）
    SightConfig->LoseSightRadius = 2000.0f;   // 失去视野的距离（20米，比看到远一点避免抖动）
    SightConfig->PeripheralVisionAngleDegrees = 60.0f;  // 周边视觉半角（前方120°锥形）
    SightConfig->DetectionByAffiliation.bDetectEnemies = true;    // 检测敌人
    SightConfig->DetectionByAffiliation.bDetectNeutrals = true;   // 检测中立
    SightConfig->DetectionByAffiliation.bDetectFriendlies = false; // 不检测友军

    // 将配置添加到感知组件
    PerceptionComp->ConfigureSense(*SightConfig);

    // ⚠️ 重要：设置感知更新时的回调函数
    // 当AI感知到东西或丢失目标时，会触发这些回调
    PerceptionComp->OnTargetPerceptionUpdated.AddDynamic(
        this,    // 绑定到当前Controller
        &AMonsterAIController::OnTargetPerceptionUpdated  // 回调函数
    );

    UE_LOG(LogTemp, Log, TEXT("AI视觉感知系统已初始化。视野半径: %f"), SightConfig->SightRadius);
}

// 感知更新回调
void AMonsterAIController::OnTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
    // Actor：被感知到的目标Actor
    // Stimulus：感知事件的详细信息

    if (Stimulus.WasSuccessfullySensed())
    {
        // ✅ 成功感知到目标！
        UE_LOG(LogTemp, Log, TEXT("AI看到了: %s"), *Actor->GetName());

        // 将感知到的目标写入Blackboard
        UBlackboardComponent* BB = GetBlackboardComponent();
        if (BB)
        {
            BB->SetValueAsObject(TEXT("TargetActor"), Actor);
            // 现在行为树中的Decorator就可以读取到 TargetActor 了
        }
    }
    else
    {
        // ❌ 目标丢失（跑出了视野范围）
        UE_LOG(LogTemp, Log, TEXT("AI丢失了目标: %s"), *Actor->GetName());

        // 清空黑板中的目标
        UBlackboardComponent* BB = GetBlackboardComponent();
        if (BB)
        {
            BB->ClearValue(TEXT("TargetActor"));
        }
    }
}
```

### AI视觉的"锥形视野"

```
                  视野半径 1500cm
                  ┌──────────────┐
                  │              │
              ╱   │              │   ╲
            ╱     │              │     ╲
          ╱       │              │       ╲
        ╱   60°   │    AI位置    │   60°   ╲   ← 总共120°视野
      ╱           │     👾      │           ╲
    ╱             │              │             ╲
  ╱               └──────────────┘               ╲

AI前方120° 锥形区域 = 视野
AI身后240° = 盲区（除非听觉能听到）
```

### 其他感知类型速览

```cpp
// 听觉感知（听到脚步声、枪声）
UAISenseConfig_Hearing* HearingConfig = CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("Hearing"));
HearingConfig->HearingRange = 2000.0f;  // 听觉范围20米
HearingConfig->DetectionByAffiliation.bDetectEnemies = true;

// 伤害感知（自动感知伤害来源，不需要特殊配置就可以检测谁打了AI）
UAISenseConfig_Damage* DamageConfig = CreateDefaultSubobject<UAISenseConfig_Damage>(TEXT("Damage"));

// 添加到感知组件
PerceptionComp->ConfigureSense(*SightConfig);
PerceptionComp->ConfigureSense(*HearingConfig);
PerceptionComp->ConfigureSense(*DamageConfig);
```

> 在后续的 "04-章节案例" 中我们会完整地配置和使用AI感知系统。

---

## ❌ 常见误区

| 误区                                       | 为什么错                            | ✅ 正确做法                                 |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------- |
| 在Task中直接调用FindAllActorsOfClass找玩家 | 每帧扫描全场景，性能极差            | 用AIPerception系统，由感知回调通知          |
| SetValueAsXxx的Key名随意写                 | Key不在Blackboard中会导致编辑器崩溃 | 先在Blackboard资产中创建Key，再在代码中使用 |
| 在OnPossess之前调用GetBlackboardComponent  | 黑板还没初始化，返回nullptr         | 在OnPossess中或之后使用                     |
| RunBehaviorTree后手动初始化Blackboard      | RunBehaviorTree已经自动处理了       | 直接用GetBlackboardComponent即可            |
| 忘记OnUnPossess中清理                      | AI死亡时行为树可能还在跑            | 确保OnUnPossess中停止                       |
| 使用TEXT("中文Key名")                      | 编辑器中不支持中文Key名             | 使用英文Key名                               |

---

## 完成检查清单

- [ ] 能用自己的话解释Blackboard的概念（"AI的共享内存"）
- [ ] 能在编辑器中创建Blackboard资产并添加不同类型的Key
- [ ] 能写出`GetBlackboardComponent()->SetValueAsVector(...)`的完整调用
- [ ] 知道`GetValueAsObject`返回的类型需要`Cast`转换
- [ ] 能写出一个完整的`AMyAIController`类（继承`AAIController`）
- [ ] 知道在`OnPossess`中调用`RunBehaviorTree`启动行为树
- [ ] 理解`MoveToActor`的参数含义（目标、半径、寻路等）
- [ ] 能说出AI感知系统的三个核心组件（Component, Sense, Config）
- [ ] 知道如何配置视觉感知（半径、角度、检测类型）
- [ ] 理解`OnTargetPerceptionUpdated`回调的触发时机

---

> **下一步**：[11.3 自定义Task与Service](./03-自定义Task与Service.md)，学习如何用C++写自己的行为树节点。
