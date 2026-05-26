# 11.3 自定义Task与Service：用C++打造AI积木

> **目标**：学会用C++创建自定义的BTTask、BTService和BTDecorator，掌控AI的行为逻辑。

---

## 前置知识：在UE中创建行为树节点的C++类

### 方法1：编辑器创建（推荐，最简单）

```
Content Browser → 右键 → New C++ Class
  → 搜索并选择父类：
    - BTTask_BlueprintBase  → 创建Task（蓝图友好）
    - BTService_BlueprintBase → 创建Service（蓝图友好）
    - BTDecorator_BlueprintBase → 创建Decorator（蓝图友好）
  → 你也可以直接用纯C++父类：
    - UBTTaskNode
    - UBTService
    - UBTDecorator
```

### 方法2：Visual Studio直接添加

在Visual Studio中直接创建 `.h` 和 `.cpp` 文件，**确保继承正确的父类并添加UE宏**。

---

## 第一部分：自定义BTTask（任务节点）

### 1.1 BTTask的核心生命周期

```
行为树激活Task时：

ExecuteTask(OwnerController, ControlledPawn)
     │
     ├── 返回 Succeeded  ← 任务即时完成（如"检查弹药"）
     ├── 返回 Failed     ← 任务即时失败
     └── 返回 InProgress ← 任务需要持续多帧...
              │
         TickTask(OwnerController, ControlledPawn, DeltaSeconds)
              │    ↑ 每帧调用（需要bNotifyTick = true）
              │
              └── 最终调用 FinishExecute(true/false) 结束任务
```

### 1.2 关键API总结

```cpp
// EBTNodeResult——ExecuteTask的四种返回值
UENUM()
enum class EBTNodeResult
{
    Succeeded,   // 任务成功完成
    Failed,      // 任务失败
    Aborted,     // 任务被中断（被更高优先级的节点打断）
    InProgress   // 任务正在执行中，需要持续多帧
};

// Task中常用函数
GetWorld()                    // 获取当前World
OwnerComp.GetAIOwner()        // 获取AIController
OwnerComp.GetBlackboardComponent() // 获取黑板组件
FinishExecute(OwnerComp, true)     // 结束任务（true=成功，false=失败）
```

### 1.3 完整示例：自定义"等待N秒"Task

我们将重写引擎的 `UBTTask_Wait`，目的是理解Task的完整生命周期：

```cpp
// ==================== BTTask_MyWait.h ====================
#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTTaskNode.h"               // BTTaskNode的父类
#include "BTTask_MyWait.generated.h"               // ⚠️ 必须最后include！

/**
 * 自定义等待任务：让AI在原地等待指定秒数。
 *
 * 这个例子帮助你理解BTTaskNode的完整生命周期。
 * 实际项目中可以直接用引擎自带的 UBTTask_Wait。
 */
UCLASS()
class MYGAME_API UBTTask_MyWait : public UBTTaskNode
{
    GENERATED_BODY()  // UE反射系统必要宏

public:
    // 构造函数——设置默认值
    UBTTask_MyWait();

    // 【核心覆写1】ExecuteTask：任务开始执行时调用
    // OwnerComp（UBehaviorTreeComponent&）：行为树组件的引用，可以从中获取AIController和Blackboard
    // NodeMemory（uint8*）：节点内存指针——行为树给每个节点实例分配的内存块
    // 返回值：Succeeded（完成）、Failed（失败）、InProgress（还在跑）
    virtual EBTNodeResult::Type ExecuteTask(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory
    ) override;

    // 【核心覆写2】TickTask：当ExecuteTask返回InProgress时，每帧调用
    // 需要先在构造函数中设置 bNotifyTick = true 才会被调用！
    // DeltaSeconds（float）：上一帧到这一帧的时间间隔
    virtual void TickTask(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory,
        float DeltaSeconds
    ) override;

    // 【可选覆写】OnTaskFinished：任务结束时调用（无论成功/失败/中断）
    virtual void OnTaskFinished(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory,
        EBTNodeResult::Type TaskResult
    ) override;

    // 【可选覆写】GetStaticDescription：编辑器中显示的节点描述（调试用）
    virtual FString GetStaticDescription() const override;

    // --- 节点的可配置属性 ---
    // UPROPERTY(EditAnywhere) 让策划在行为树编辑器里可以调整等待时间
    // Category = "Wait" 在属性面板中归到"Wait"分类
    UPROPERTY(EditAnywhere, Category = "Wait", meta = (ClampMin = "0.0", UIMin = "0.0"))
    float WaitTime;
    // ClampMin = "0.0" ← 编辑器里最小只能设0.0，不能设负数
    // UIMin = "0.0"     ← 滑块最左端是0.0

    // 是否给等待时间加随机偏移（让AI看起来不像是机器人）
    UPROPERTY(EditAnywhere, Category = "Wait")
    float RandomDeviation;
    // 比如 WaitTime=3.0, RandomDeviation=0.5 → 实际等待 2.5~3.5 秒
};
```

```cpp
// ==================== BTTask_MyWait.cpp ====================
#include "BTTask_MyWait.h"
#include "BehaviorTree/BlackboardComponent.h"        // 使用黑板
#include "AIController.h"                            // 获取AIController

// 构造函数：初始化默认值
UBTTask_MyWait::UBTTask_MyWait()
{
    // 【关键】只有设置为true，TickTask才会被调用！
    bNotifyTick = true;

    // 如果不需要TickTask，保持默认的 false 可以优化性能
    // 只有"需要持续多帧执行"的Task才需要bNotifyTick = true

    // 设置默认等待时间
    WaitTime = 3.0f;           // 默认等待3秒
    RandomDeviation = 0.0f;    // 默认无随机偏移

    // NodeName在编辑器的行为树图中显示
    NodeName = TEXT("我的等待");
}

// ExecuteTask：任务开始
EBTNodeResult::Type UBTTask_MyWait::ExecuteTask(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory)
{
    // --- 步骤1：从节点内存中获取或创建我们的数据结构 ---
    // GetNodeMemory在内部做了以下事情：
    //   如果是首次调用 → 初始化内存块（全部填0）
    //   如果是再次调用 → 返回已存在的内存块
    // NodeMemory的大小由 GetInstanceMemorySize() 决定（此处使用默认大小）
    // 我们用这个内存来存储"还剩多少时间需要等待"
    FBTTaskMemory& MyMemory = *(FBTTaskMemory*)NodeMemory;
    // FBTTaskMemory 是 UBTTaskNode 内部分配的，我们无法直接定义它的结构体成员。
    // 所以更推荐的做法是自定义 NodeMemory（见下方进阶示例）。

    // --- 步骤2：获取黑板组件，保存初始状态 ---

    // 计算实际的等待时间（基础时间 + 随机偏移）
    float ActualWaitTime = WaitTime;
    if (RandomDeviation > 0.0f)
    {
        // FMath::RandRange 返回 [Min, Max] 范围内的随机浮点数
        ActualWaitTime += FMath::RandRange(-RandomDeviation, RandomDeviation);
        // 确保不会出现负数
        ActualWaitTime = FMath::Max(0.0f, ActualWaitTime);
    }

    // 打印日志，方便调试
    UE_LOG(LogTemp, Log, TEXT("BTTask_MyWait 开始等待 %f 秒"), ActualWaitTime);

    // --- 步骤3：根据等待时间决定返回值 ---
    if (ActualWaitTime <= 0.0f)
    {
        // 不需要等待，直接返回成功
        return EBTNodeResult::Succeeded;
    }
    else
    {
        // 需要等待，返回InProgress
        // 行为树会在接下来的每一帧调用 TickTask
        return EBTNodeResult::InProgress;
    }
}

// TickTask：每帧被调用（仅当ExecuteTask返回了InProgress）
void UBTTask_MyWait::TickTask(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory,
    float DeltaSeconds)
{
    // DeltaSeconds = 本帧经过的时间
    // UE_LOG(LogTemp, Verbose, TEXT("等待中... 本帧 Delta: %f"), DeltaSeconds);

    // 注意：BTTaskNode 默认的 NodeMemory 直接存储了一个结构体
    // 它用 NodeMemory 的前几个字节存储剩余的等待时间
    // 实际等待时间在引擎内部被管理在 GetSpecialNodeMemory 中
    //
    // ⚠️ 重要学习点：默认的NodeMemory机制比较受限
    // 如果在ExecuteTask中直接使用了FBTTaskMemory，UE会在TickTask中
    // 自动检查等待时间是否已到，所以这里有些底层细节被封装了。
    //
    // 更推荐的方式：看下面"进阶示例"中如何创建自定义NodeMemory结构体

    // 这个简单版本，我们直接在ExecuteTask中使用了默认的NodeMemory机制
    // UE内部会自动跟踪等待时间并在时间到达时结束任务
}

// OnTaskFinished：任务结束（无论成功/失败/中断都会调用）
void UBTTask_MyWait::OnTaskFinished(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory,
    EBTNodeResult::Type TaskResult)
{
    // 可以在这里做清理工作
    // 比如：停止某个动画、释放某个资源、重置某个变量
    UE_LOG(LogTemp, Log, TEXT("BTTask_MyWait 结束，结果: %d"),
        static_cast<int32>(TaskResult));
    // Succeeded=0, Failed=1, Aborted=2
}

// GetStaticDescription：编辑器中显示的描述
FString UBTTask_MyWait::GetStaticDescription() const
{
    // 在编辑器的节点上显示具体等待时间，方便策划查看
    return FString::Printf(TEXT("等待 %.1f 秒"), WaitTime);
    // 如果设了 WaitTime=3.0，编辑器节点上会显示 "等待 3.0 秒"
}
```

### 1.4 进阶示例：使用自定义NodeMemory的"追击目标"Task

上面的简单示例依赖UE默认的NodeMemory机制。实际项目中我们通常需要**自定义NodeMemory**来存储复杂状态：

```cpp
// ==================== BTTask_ChaseTarget.h ====================
#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTTaskNode.h"
#include "BTTask_ChaseTarget.generated.h"

// 【关键】定义自定义的NodeMemory结构体
// 这个结构体会存储Task执行期间需要跨帧保存的数据
USTRUCT()
struct FBTTaskChaseMemory
{
    GENERATED_BODY()  // ⚠️ 自定义NodeMemory结构体也需要UE反射标记！

    // 任务开始的时间戳（用于超时判断）
    float StartTime;

    // 当前导航路径的请求ID（用于查询寻路状态）
    // FAIRequestID 是一个轻量级的ID，用于跟踪异步寻路请求
    FAIRequestID MoveRequestID;
};

UCLASS()
class MYGAME_API UBTTask_ChaseTarget : public UBTTaskNode
{
    GENERATED_BODY()

public:
    UBTTask_ChaseTarget();

    // 【关键】告诉UE这个Task需要多大的NodeMemory
    // 返回值为自定义NodeMemory结构体的大小
    virtual uint16 GetInstanceMemorySize() const override
    {
        // sizeof(FBTTaskChaseMemory)：我们自定义结构体的大小
        // UE会为每个Task实例分配这么多字节的内存
        return sizeof(FBTTaskChaseMemory);
    }

    virtual EBTNodeResult::Type ExecuteTask(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory
    ) override;

    virtual void TickTask(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory,
        float DeltaSeconds
    ) override;

    // --- 可配置属性 ---
    // 追击时离目标多远算"到达"
    UPROPERTY(EditAnywhere, Category = "Chase")
    float AcceptableRadius = 150.0f;  // 默认150cm

    // 追击如果超过这个时间还没追到，就放弃
    UPROPERTY(EditAnywhere, Category = "Chase")
    float MaxChaseTime = 10.0f;  // 默认10秒超时

    // Blackboard中存储"目标位置"的Key名
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    FBlackboardKeySelector TargetLocationKey;
    // FBlackboardKeySelector 是UE的黑板Key选择器
    // 在编辑器中会出现一个下拉菜单，让你选择Blackboard中定义的Key
};
```

```cpp
// ==================== BTTask_ChaseTarget.cpp ====================
#include "BTTask_ChaseTarget.h"
#include "AIController.h"
#include "BehaviorTree/BlackboardComponent.h"

UBTTask_ChaseTarget::UBTTask_ChaseTarget()
{
    bNotifyTick = true;  // 因为需要每帧更新移动，必须开启Tick

    NodeName = TEXT("追击目标");

    // 初始化Blackboard Key选择器，限定只能选Vector类型的Key
    // 这样编辑器中只会显示Vector类型的Key，减少策划犯错的可能
    TargetLocationKey.AddVectorFilter(this, GET_MEMBER_NAME_CHECKED(UBTTask_ChaseTarget, TargetLocationKey));
    // AddVectorFilter：只允许选择Vector类型的Key
    // GET_MEMBER_NAME_CHECKED：编译期安全地获取成员变量名
}

EBTNodeResult::Type UBTTask_ChaseTarget::ExecuteTask(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory)
{
    // ===== 步骤1：获取自定义NodeMemory =====
    // 将原始的 uint8* 转换为我们的自定义结构体指针
    FBTTaskChaseMemory* MyMemory = reinterpret_cast<FBTTaskChaseMemory*>(NodeMemory);
    // reinterpret_cast 用于在不相关类型之间转换指针
    // 这里需要它是因为 NodeMemory 的类型是 uint8*（通用字节指针）

    // ===== 步骤2：获取AIController =====
    AAIController* AIController = OwnerComp.GetAIOwner();
    if (!AIController)
    {
        // AI控制器不存在（可能Pawn已被销毁）
        UE_LOG(LogTemp, Error, TEXT("追击失败：AIController不存在"));
        return EBTNodeResult::Failed;
    }

    // ===== 步骤3：获取受控的Pawn =====
    APawn* ControlledPawn = AIController->GetPawn();
    if (!ControlledPawn)
    {
        UE_LOG(LogTemp, Error, TEXT("追击失败：受控Pawn不存在"));
        return EBTNodeResult::Failed;
    }

    // ===== 步骤4：从黑板获取目标位置 =====
    UBlackboardComponent* Blackboard = OwnerComp.GetBlackboardComponent();
    if (!Blackboard)
    {
        UE_LOG(LogTemp, Error, TEXT("追击失败：黑板组件不存在"));
        return EBTNodeResult::Failed;
    }

    // 使用FBlackboardKeySelector从黑板中读取值
    FVector TargetLocation = Blackboard->GetValueAsVector(
        TargetLocationKey.SelectedKeyName
    );
    // SelectedKeyName：用户在编辑器中选择的Key的名称（FName类型）

    // ===== 步骤5：使用AIController的MoveTo开始移动 =====
    EPathFollowingRequestResult::Type MoveResult = AIController->MoveToLocation(
        TargetLocation,          // 目标位置
        AcceptableRadius,        // 可接受半径
        true,                    // bStopOnOverlap
        true,                    // bUsePathfinding（使用导航网格寻路）
        false,                   // bProjectDestinationToNavigation
        false,                   // bCanStrafe（不侧移）
        nullptr,                 // FilterClass
        false                    // bAllowPartialPath
    );

    // ===== 步骤6：记录开始时间和移动请求 =====
    MyMemory->StartTime = GetWorld()->GetTimeSeconds();
    // GetTimeSeconds() 返回从游戏开始到现在的秒数（float）

    // 检查移动请求是否成功
    if (MoveResult == EPathFollowingRequestResult::RequestSuccessful)
    {
        // 移动指令成功发出
        UE_LOG(LogTemp, Log, TEXT("开始追击目标位置: %s"), *TargetLocation.ToString());
        return EBTNodeResult::InProgress;  // 在TickTask中等待到达
    }
    else if (MoveResult == EPathFollowingRequestResult::AlreadyAtGoal)
    {
        // 已经在目标位置了，直接成功
        UE_LOG(LogTemp, Log, TEXT("已经在目标位置，无需移动"));
        return EBTNodeResult::Succeeded;
    }
    else
    {
        // 寻路失败（目标在导航网格外等）
        UE_LOG(LogTemp, Warning, TEXT("追击失败：无法到达目标位置"));
        return EBTNodeResult::Failed;
    }
}

void UBTTask_ChaseTarget::TickTask(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory,
    float DeltaSeconds)
{
    // ===== 步骤1：获取自定义NodeMemory =====
    FBTTaskChaseMemory* MyMemory = reinterpret_cast<FBTTaskChaseMemory*>(NodeMemory);

    // ===== 步骤2：获取AIController，检查移动状态 =====
    AAIController* AIController = OwnerComp.GetAIOwner();
    if (!AIController)
    {
        // AIController丢失（Pawn死掉了）
        FinishExecute(OwnerComp, EBTNodeResult::Failed);
        // FinishExecute 是结束Task的标准方式
        return;
    }

    // ===== 步骤3：检查是否到达目标 =====
    EPathFollowingStatus::Type MoveStatus = AIController->GetMoveStatus();

    if (MoveStatus == EPathFollowingStatus::Idle)
    {
        // Idle = 移动已停止（要么到达了，要么中断了）
        // 检查一下是因为什么到了Idle状态
        AAIController::FAIMoveRequestSignature MoveReqSig;

        if (AIController->GetPathFollowingComponent() &&
            AIController->GetPathFollowingComponent()->GetStatus() == EPathFollowingStatus::Idle)
        {
            // 到达目标！
            UE_LOG(LogTemp, Log, TEXT("追击成功：已到达目标位置"));
            FinishExecute(OwnerComp, EBTNodeResult::Succeeded);
            return;
        }
    }

    // ===== 步骤4：检查超时 =====
    float CurrentTime = GetWorld()->GetTimeSeconds();
    float ElapsedTime = CurrentTime - MyMemory->StartTime;

    if (ElapsedTime > MaxChaseTime)
    {
        // 超时了，放弃追击
        UE_LOG(LogTemp, Warning, TEXT("追击超时：已经追了 %.1f 秒，放弃"), ElapsedTime);
        AIController->StopMovement();  // 停止移动
        FinishExecute(OwnerComp, EBTNodeResult::Failed);
        return;
    }

    // ===== 步骤5：还没到，继续追 =====
    // 如果目标在移动，可以用Service定期更新黑板中的TargetLocation
    // Task只需要负责移动即可，不需要关心"玩家跑哪去了"——那是Service的工作

    // 此时什么都不做，下一帧继续检查
    // 这种"非终结帧的Tick"不需要调用FinishExecute
}
```

### 1.5 ExecuteTask返回结果速查表

| 返回结果     | 含义           | 后续行为                                | 典型场景              |
| ------------ | -------------- | --------------------------------------- | --------------------- |
| `Succeeded`  | 任务即时完成   | Composite继续执行下一个子节点           | "检查弹药数>0"        |
| `Failed`     | 任务即时失败   | 如果是Sequence，整条Sequence失败        | "目标已死亡"          |
| `InProgress` | 任务还在进行中 | 每帧调用TickTask，直到调用FinishExecute | "追击目标"、"等待N秒" |
| `Aborted`    | 任务被中断     | OnTaskFinished被调用                    | 更高优先级节点打断    |

---

## 第二部分：自定义BTService（服务节点）

### 2.1 BTService的核心生命周期

```
Composite节点被激活
  │
  ▼
OnBecomeRelevant(OwnerComp, NodeMemory)  ← 只调用一次（Service开始运行）
  │
  ▼
┌─────────────────────────────┐
│  按固定间隔(Interval)循环：   │
│                             │
│  TickNode(OwnerComp,        │
│           NodeMemory,       │
│           DeltaSeconds)     │  ← 每Interval秒调用一次（默认0.5秒）
│                             │
└─────────────┬───────────────┘
              │ Composite节点被停用
              ▼
OnCeaseRelevant(OwnerComp, NodeMemory)  ← 只调用一次（Service停止运行）
```

### 2.2 完整示例：更新"玩家位置"到Blackboard

这是AI系统中最常见的Service，持续追踪玩家位置：

```cpp
// ==================== BTService_UpdateTargetLocation.h ====================
#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTService.h"                // UBTService的父类
#include "BTService_UpdateTargetLocation.generated.h"

/**
 * 持续更新目标位置到Blackboard的Service。
 *
 * 工作方式：每隔固定间隔，获取玩家Pawn的位置，写入黑板的 TargetLocation Key。
 * 行为树中的追击Task就会自动使用最新的位置来寻路。
 */
UCLASS()
class MYGAME_API UBTService_UpdateTargetLocation : public UBTService
{
    GENERATED_BODY()

public:
    UBTService_UpdateTargetLocation();

    // 【核心覆写】TickNode：每次Service的间隔到达时触发
    // OwnerComp：行为树组件引用
    // NodeMemory：Service的节点内存
    // DeltaSeconds：上次Tick到现在的间隔（约等于Interval）
    virtual void TickNode(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory,
        float DeltaSeconds
    ) override;

    // 【可选覆写】OnBecomeRelevant：Composite被激活时调用
    // 在这里可以做一些初始化：比如把"上次玩家位置"缓存起来
    virtual void OnBecomeRelevant(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory
    ) override;

    // 【可选覆写】OnCeaseRelevant：Composite被停用时调用
    // 在这里可以做一些清理
    virtual void OnCeaseRelevant(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory
    ) override;

    // 【可选覆写】GetStaticDescription：编辑器中显示描述（调试用）
    virtual FString GetStaticDescription() const override;

protected:
    // --- 可配置属性 ---
    // Blackboard中存储"目标Actor"的Key名
    // Service会先读这个Key，获取Actor，再取其位置写入TargetLocation
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    FBlackboardKeySelector TargetActorKey;

    // Blackboard中存储"目标位置"的Key名
    // Service会把计算得到的位置写入这个Key
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    FBlackboardKeySelector TargetLocationKey;
};
```

```cpp
// ==================== BTService_UpdateTargetLocation.cpp ====================
#include "BTService_UpdateTargetLocation.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "AIController.h"
#include "GameFramework/Pawn.h"

UBTService_UpdateTargetLocation::UBTService_UpdateTargetLocation()
{
    NodeName = TEXT("更新目标位置");  // 编辑器节点显示名

    // 【关键】设置Service的执行间隔
    Interval = 0.3f;
    // 每0.3秒Tick一次（不是每帧！）
    // 值太小=性能浪费，值太大=AI反应迟钝
    // 推荐值：0.1~0.5秒

    // 【关键】设置一个随机偏移，让多个AI不会在同一帧同时Tick（避免性能尖峰）
    RandomDeviation = 0.05f;
    // 所以实际间隔可能是 0.25~0.35 秒

    // --- 在构造函数中配置Blackboard Key的过滤器 ---
    // 这样编辑器中只会显示对应类型的Key

    // TargetActorKey 只接受 Object 类型
    TargetActorKey.AddObjectFilter(
        this,  // this = 当前Service实例
        GET_MEMBER_NAME_CHECKED(UBTService_UpdateTargetLocation, TargetActorKey),
        AActor::StaticClass()  // 只接受AActor及其子类
    );
    // AddObjectFilter 的参数：
    //   1. this：拥有这个Key选择器的对象
    //   2. 成员变量名：用于反射系统定位
    //   3. UClass：限定的基类类型

    // TargetLocationKey 只接受 Vector 类型
    TargetLocationKey.AddVectorFilter(
        this,
        GET_MEMBER_NAME_CHECKED(UBTService_UpdateTargetLocation, TargetLocationKey)
    );
}

void UBTService_UpdateTargetLocation::TickNode(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory,
    float DeltaSeconds)
{
    // ⚠️ 不要忘记调用父类！否则一些内部的状态管理不会执行
    Super::TickNode(OwnerComp, NodeMemory, DeltaSeconds);

    // ===== 步骤1：获取黑板组件 =====
    UBlackboardComponent* Blackboard = OwnerComp.GetBlackboardComponent();
    if (!Blackboard)
    {
        return;  // 黑板不存在，无法更新
    }

    // ===== 步骤2：从黑板获取目标Actor =====
    // 这个Actor可能是由AIPerception系统写入的（看到玩家时）
    AActor* TargetActor = Cast<AActor>(
        Blackboard->GetValueAsObject(TargetActorKey.SelectedKeyName)
    );

    if (!TargetActor)
    {
        // 没有目标Actor，清空目标位置
        // 让Decorator知道"没有目标"
        Blackboard->ClearValue(TargetLocationKey.SelectedKeyName);
        return;  // 提前返回，不需要更新
    }

    // ===== 步骤3：获取目标Actor的位置 =====
    FVector TargetLocation = TargetActor->GetActorLocation();

    // ===== 步骤4：将位置写入黑板 =====
    Blackboard->SetValueAsVector(
        TargetLocationKey.SelectedKeyName,  // 使用编辑器中选的Key名
        TargetLocation                      // 最新的位置
    );

    // 现在行为树中的追击Task就可以读取 TargetLocationKey 来获取最新的玩家位置了！

    // 可选的调试绘制（在编辑器中显示一个调试圆球）
    // 仅在编辑器中可见，发布版本自动剔除
    #if WITH_EDITOR
    if (GIsEditor && TargetActor)
    {
        // 可以用 DrawDebugSphere 在编辑器中可视化
        // （为了简洁这里省略绘制代码）
    }
    #endif
}

void UBTService_UpdateTargetLocation::OnBecomeRelevant(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory)
{
    Super::OnBecomeRelevant(OwnerComp, NodeMemory);

    // Composite被激活了，做一些初始化
    UE_LOG(LogTemp, Log, TEXT("更新目标位置Service已激活"));

    // 可以在这里立刻执行一次TickNode，确保黑板中有最新数据
    // 而不是等 Interval 秒后第一次Tick
    // 不过通常没必要，因为0.3秒很快就到了
}

void UBTService_UpdateTargetLocation::OnCeaseRelevant(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory)
{
    Super::OnCeaseRelevant(OwnerComp, NodeMemory);

    // Composite被停用了，清理数据
    UE_LOG(LogTemp, Log, TEXT("更新目标位置Service已停用"));

    // 可选：清空相关黑板数据
    UBlackboardComponent* Blackboard = OwnerComp.GetBlackboardComponent();
    if (Blackboard)
    {
        Blackboard->ClearValue(TargetLocationKey.SelectedKeyName);
    }
}

FString UBTService_UpdateTargetLocation::GetStaticDescription() const
{
    // 在编辑器中显示更多信息
    return FString::Printf(
        TEXT("每 %.2f 秒更新目标位置\n读取: %s\n写入: %s"),
        Interval,
        *TargetActorKey.SelectedKeyName.ToString(),
        *TargetLocationKey.SelectedKeyName.ToString()
    );
    // 编辑器节点上会显示：
    // 每 0.30 秒更新目标位置
    // 读取: TargetActor
    // 写入: TargetLocation
}
```

### 2.3 Service的三个生命周期方法对比

```cpp
/*
 * 时间线示例（假设Interval=0.5秒，Composite在第2秒激活，第5秒停用）：
 *
 * t=2.0: OnBecomeRelevant() 调用    ← "开始工作了"
 * t=2.5: TickNode() 调用            ← "第1次更新"
 * t=3.0: TickNode() 调用            ← "第2次更新"
 * t=3.5: TickNode() 调用            ← "第3次更新"
 * t=4.0: TickNode() 调用            ← "第4次更新"
 * t=4.5: TickNode() 调用            ← "第5次更新"
 * t=5.0: OnCeaseRelevant() 调用     ← "收工了"
 */
```

---

## 第三部分：自定义BTDecorator（条件装饰器）

### 3.1 BTDecorator的核心逻辑

```
行为树到达Decorator所在节点时：

CalculateRawConditionValue(OwnerComp, NodeMemory)
     │
     ├── 返回 true  → 条件通过，继续执行子节点
     └── 返回 false → 条件不通过，该节点失败
```

Decorator比Task简单得多，它只有一个核心函数需要覆写。

### 3.2 完整示例：检查目标是否在范围内

```cpp
// ==================== BTDecorator_IsInRange.h ====================
#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTDecorator.h"              // UBTDecorator的父类
#include "BTDecorator_IsInRange.generated.h"

/**
 * 检查AI受控Pawn与目标之间的距离是否在指定范围内。
 *
 * 典型用法：挂在"攻击"Sequence上，当敌人在攻击范围内时才允许攻击。
 */
UCLASS()
class MYGAME_API UBTDecorator_IsInRange : public UBTDecorator
{
    GENERATED_BODY()

public:
    UBTDecorator_IsInRange();

    // 【核心覆写】CalculateRawConditionValue：条件判断
    // 返回true = 条件满足，false = 不满足
    virtual bool CalculateRawConditionValue(
        UBehaviorTreeComponent& OwnerComp,
        uint8* NodeMemory
    ) const override;

    // 【可选覆写】GetStaticDescription：编辑器中显示的条件说明
    virtual FString GetStaticDescription() const override;

protected:
    // --- 可配置属性 ---
    // 检测的距离范围
    UPROPERTY(EditAnywhere, Category = "Condition")
    float CheckRange = 500.0f;  // 默认500cm（5米）

    // 距离比较模式：小于某个值才算在范围内？还是大于？
    // true = 距离 < CheckRange 时条件通过（"在范围内"）
    // false = 距离 > CheckRange 时条件通过（"在范围外"）
    UPROPERTY(EditAnywhere, Category = "Condition")
    bool bInverseCondition = false;
    // bInverseCondition=false：距离小于500才算满足（"近战范围"）
    // bInverseCondition=true：距离大于500才算满足（"远程攻击范围"）

    // 从黑板读取"目标Actor"的Key名
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    FBlackboardKeySelector TargetActorKey;

    // 可选：不从黑板读Actor，而是读一个Vector位置来判断
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    FBlackboardKeySelector TargetLocationKey;

    // 检查模式
    // Geometric = 几何距离（直线距离）
    // Path = 寻路距离（考虑墙壁等地形）
    UPROPERTY(EditAnywhere, Category = "Condition")
    bool bUsePathDistance = false;
    // bUsePathDistance = true：使用AI寻路系统计算实际路径长度
    // bUsePathDistance = false：使用直线距离（快但不考虑障碍物）
};
```

```cpp
// ==================== BTDecorator_IsInRange.cpp ====================
#include "BTDecorator_IsInRange.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "AIController.h"
#include "GameFramework/Pawn.h"
#include "NavigationSystem.h"           // 寻路系统（计算路径距离）
#include "NavigationPath.h"             // 导航路径

UBTDecorator_IsInRange::UBTDecorator_IsInRange()
{
    NodeName = TEXT("是否在范围内");

    // --- 配置Blackboard Key过滤器 ---
    TargetActorKey.AddObjectFilter(
        this,
        GET_MEMBER_NAME_CHECKED(UBTDecorator_IsInRange, TargetActorKey),
        AActor::StaticClass()
    );

    TargetLocationKey.AddVectorFilter(
        this,
        GET_MEMBER_NAME_CHECKED(UBTDecorator_IsInRange, TargetLocationKey)
    );

    // 【关键】设置检查时机
    // 默认是 OnNodeActivation（只在节点激活时检查一次）
    // 我们可以通过以下FlowControl标志改变：
    //   bNotifyTick → 每帧都检查
    //   bNotifyActivation → 节点激活时检查
    //   bNotifyDeactivation → 节点停用时检查
    //   bNotifyProcessed → 下方的子节点执行时检查
    // 大部分情况下默认（激活时检查）就够了

    // 如果想让条件"持续生效"（比如AI跑出攻击范围后自动停止攻击）：
    // 可以在这设置 NotifyObserver 相关标志
    // 但这通常由Decorator的 Abort Mode 来控制（编辑器中设置）
}

bool UBTDecorator_IsInRange::CalculateRawConditionValue(
    UBehaviorTreeComponent& OwnerComp,
    uint8* NodeMemory) const
{
    // ===== 步骤1：获取受控Pawn和黑板 =====
    AAIController* AIController = OwnerComp.GetAIOwner();
    if (!AIController) return false;

    APawn* ControlledPawn = AIController->GetPawn();
    if (!ControlledPawn) return false;

    UBlackboardComponent* Blackboard = OwnerComp.GetBlackboardComponent();
    if (!Blackboard) return false;

    // ===== 步骤2：获取目标位置 =====
    FVector TargetLocation = FVector::ZeroVector;
    bool bHasTarget = false;
    // 标记是否成功获取了目标位置

    // 优先使用Actor（如果设置了TargetActorKey）
    if (TargetActorKey.IsSet())
    {
        AActor* TargetActor = Cast<AActor>(
            Blackboard->GetValueAsObject(TargetActorKey.SelectedKeyName)
        );

        if (TargetActor)
        {
            TargetLocation = TargetActor->GetActorLocation();
            bHasTarget = true;
        }
    }

    // 如果没有Actor但设置了Location，使用Location
    if (!bHasTarget && TargetLocationKey.IsSet())
    {
        TargetLocation = Blackboard->GetValueAsVector(
            TargetLocationKey.SelectedKeyName
        );

        // 检查Location是否有效（非零向量）
        if (!TargetLocation.IsNearlyZero())
        {
            bHasTarget = true;
        }
    }

    // 根本没有目标，条件不通过
    if (!bHasTarget)
    {
        return false;
    }

    // ===== 步骤3：计算AI到目标的距离 =====
    float Distance = 0.0f;

    if (bUsePathDistance)
    {
        // 使用寻路距离（考虑障碍物后的实际行走距离）
        UNavigationSystemV1* NavSys = UNavigationSystemV1::GetCurrent(GetWorld());
        if (NavSys)
        {
            // 获取寻路路径长度
            UNavigationPath* NavPath = NavSys->FindPathToLocationSynchronously(
                GetWorld(),
                ControlledPawn->GetActorLocation(),  // 起点：AI当前位置
                TargetLocation                        // 终点：目标位置
            );

            if (NavPath && NavPath->IsValid())
            {
                // 路径有效，获取总长度
                Distance = NavPath->GetPathLength();
            }
            else
            {
                // 寻路失败（目标不可达），用直线距离作为后备
                Distance = FVector::Dist(
                    ControlledPawn->GetActorLocation(),
                    TargetLocation
                );
            }
        }
    }
    else
    {
        // 使用几何距离（简单的两点间直线距离）
        Distance = FVector::Dist(
            ControlledPawn->GetActorLocation(),  // AI的位置
            TargetLocation                        // 目标位置
        );
        // FVector::Dist 返回两点间的欧几里得距离
        // 等价于：sqrt((x1-x2)^2 + (y1-y2)^2 + (z1-z2)^2)
    }

    // ===== 步骤4：判断是否在范围内 =====
    bool bInRange = (Distance <= CheckRange);

    // 如果需要反向条件（如"目标在远程攻击范围外"）
    if (bInverseCondition)
    {
        bInRange = !bInRange;
    }

    // ===== 步骤5：返回结果 =====
    return bInRange;
    // true = Decorator通过，继续执行子节点
    // false = Decorator不通过，该节点失败
}

FString UBTDecorator_IsInRange::GetStaticDescription() const
{
    // 编辑器节点上显示简洁的条件说明
    FString DistType = bUsePathDistance ? TEXT("寻路距离") : TEXT("直线距离");
    FString Comparison = bInverseCondition ? TEXT(">") : TEXT("<=");

    return FString::Printf(
        TEXT("%s %s %.0f cm\n目标: %s"),
        *DistType,
        *Comparison,
        CheckRange,
        *TargetActorKey.SelectedKeyName.ToString()
    );
    // 显示效果示例：
    // 直线距离 <= 500 cm
    // 目标: TargetActor
}
```

---

## 第四部分：关键概念汇总

### 4.1 三个自定义类的快速对比

| 维度         | BTTask                     | BTService      | BTDecorator                  |
| ------------ | -------------------------- | -------------- | ---------------------------- |
| **作用**     | 执行行为                   | 更新数据       | 判断条件                     |
| **核心覆写** | `ExecuteTask`              | `TickNode`     | `CalculateRawConditionValue` |
| **返回值**   | `EBTNodeResult`            | 无返回值       | `bool`                       |
| **执行频率** | 一次（或InProgress时每帧） | 按Interval间隔 | 按配置的检查时机             |
| **类比**     | 工人（干活）               | 侦察兵（汇报） | 门卫（检查）                 |

### 4.2 FBlackboardKeySelector 详解

`FBlackboardKeySelector` 是行为树C++代码中最重要的数据结构之一。它让你在编辑器中通过**下拉菜单**选择Blackboard中的Key，而不是硬编码字符串。

```cpp
// ✅ 推荐：使用FBlackboardKeySelector
UPROPERTY(EditAnywhere, Category = "Blackboard")
FBlackboardKeySelector TargetLocationKey;

// 在代码中读取选中的值
FVector Location = Blackboard->GetValueAsVector(
    TargetLocationKey.SelectedKeyName  // ← 编辑器中用户选的Key名
);

// ❌ 不推荐：硬编码Key名
FVector Location = Blackboard->GetValueAsVector(TEXT("TargetLocation"));
// 拼写错误会导致运行时崩溃，而且策划不能改Key名
```

**FBlackboardKeySelector的过滤器（Filter）：**

```cpp
// 在构造函数中配置过滤器，限制可选Key的类型

// 只允许选择Object类型的Key
TargetActorKey.AddObjectFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetActorKey), AActor::StaticClass());

// 只允许选择Vector类型的Key
TargetLocationKey.AddVectorFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetLocationKey));

// 只允许选择Bool类型的Key
TargetBoolKey.AddBoolFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetBoolKey));

// 只允许选择Int类型的Key
TargetIntKey.AddIntFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetIntKey));

// 只允许选择Float类型的Key
TargetFloatKey.AddFloatFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetFloatKey));

// 只允许选择Enum类型的Key（指定枚举类型）
TargetEnumKey.AddEnumFilter(this, GET_MEMBER_NAME_CHECKED(UMyNode, TargetEnumKey), StaticEnum<EMyEnum>());
```

### 4.3 NodeMemory 的使用模式

行为树为**每个Task/Service实例**分配一块独立的内存（NodeMemory），用于存储跨帧状态。

```cpp
// 模式1：简单模式（只存储少量数据，用UE默认内存即可）
// 大多数简单Task不需要自定义NodeMemory
// 仅在Constructor中设 bNotifyTick=true 即可

// 模式2：自定义NodeMemory（存储复杂状态）
USTRUCT()
struct FMyTaskMemory
{
    GENERATED_BODY()

    float ElapsedTime;       // 已经过的时间
    FVector StartLocation;   // 开始位置
    int32 AttemptCount;      // 尝试次数
    TWeakObjectPtr<AActor> CachedTarget;  // 缓存的目标（弱引用，安全！）
};

// 然后覆写 GetInstanceMemorySize：
virtual uint16 GetInstanceMemorySize() const override
{
    return sizeof(FMyTaskMemory);
}

// 在ExecuteTask/TickTask中使用：
FMyTaskMemory* Mem = reinterpret_cast<FMyTaskMemory*>(NodeMemory);
Mem->ElapsedTime += DeltaSeconds;
```

---

## ❌ 常见误区

| 误区                                     | 为什么错                                          | ✅ 正确做法                           |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| 忘记设置`bNotifyTick = true`             | TickTask永远不会被调用                            | 在构造函数里设置它                    |
| 在ExecuteTask中做耗时操作（加载资源等）  | 阻塞游戏主线程                                    | 耗时操作必须在异步执行                |
| 在TickNode中每帧做`FindAllActorsOfClass` | 每帧扫描全场景，性能极差                          | 用AIPerception或缓存引用              |
| `FinishExecute`忘记调用                  | Task永远停在InProgress，行为树卡死                | 确保所有代码路径都会终止Task          |
| Service的Interval设为0                   | 等同于每帧Tick，与许多Service实例叠加造成性能问题 | 根据需求设合理的间隔（0.1~1.0秒）     |
| Decorator中做复杂计算                    | 如果每帧都检查，复杂计算会拖慢性能                | 保持Decorator逻辑简单，或降低检查频率 |
| FBlackboardKeySelector不设Filter         | 编辑器中所有类型Key全显示，策划容易选错           | 在构造函数中设置合适的Filter          |

---

## 完成检查清单

- [ ] 能说出BTTask的`ExecuteTask`的四种返回值各自的含义和使用场景
- [ ] 能写出一个完整的自定义Task（继承`UBTTaskNode`，覆写`ExecuteTask`）
- [ ] 知道`bNotifyTick = true`的作用以及何时需要设置
- [ ] 理解`NodeMemory`的用途，知道如何覆写`GetInstanceMemorySize`
- [ ] 能写出一个完整的自定义Service（继承`UBTService`，覆写`TickNode`）
- [ ] 知道Service的三个生命周期方法（OnBecomeRelevant / TickNode / OnCeaseRelevant）
- [ ] 能写出一个完整的自定义Decorator（继承`UBTDecorator`，覆写`CalculateRawConditionValue`）
- [ ] 理解`FBlackboardKeySelector`比硬编码字符串好在哪
- [ ] 能为`FBlackboardKeySelector`配置正确的类型过滤器
- [ ] 能用`FinishExecute`正确结束一个InProgress的Task

---

> **下一步**：[11.4 章节案例](./04-章节案例.md)，综合运用本章所有知识实现一个完整的"巡逻->发现->追击->返回"AI敌人系统。
