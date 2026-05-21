# 4.1 AActor详解：场景中所有物体的基类

> **目标**：理解AActor是什么，它在UE中扮演什么角色，掌握Actor的生命周期、Transform系统、标签系统和查找方法。

---

## 什么是AActor？

`AActor` 是UE中**可以在场景（World）中存在、有Transform（位置/旋转/缩放）的所有物体的基类**。你在游戏世界里看到的、碰撞到的、与之交互的一切——从一棵树到玩家角色，从一盏灯到一个触发区域——都派生自 `AActor`。

```
游戏世界中的一切
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│    树         灯         玩家角色         门         子弹     │
│    ↓          ↓           ↓              ↓          ↓       │
│  AStatic    APoint      ACharacter    ADoor      AProjectile │
│  MeshActor  Light                                                  │
│    │          │           │              │          │        │
│    └──────────┴───────────┴──────────────┴──────────┘        │
│                          │                                    │
│                        AActor  ← 场景物体的最终基类            │
│                          │                                    │
│                       UObject  ← UE对象的根                    │
└──────────────────────────────────────────────────────────────┘
```

### Actor vs 普通UObject

| 特性                     | UObject             | AActor                     |
| ------------------------ | ------------------- | -------------------------- |
| 存在于场景中             | ❌ 不可以           | ✅ 可以放置到关卡          |
| 有Transform              | ❌ 无位置/旋转/缩放 | ✅ 有（通过RootComponent） |
| 有生命周期回调           | ❌ 只有构造/析构    | ✅ BeginPlay/Tick/EndPlay  |
| 可以挂载组件             | ❌ 不可以           | ✅ 可以（Component体系）   |
| 可以被网络复制           | ❌ 不支持           | ✅ 支持                    |
| 可以被蓝图继承并放到关卡 | ❌ 不可以           | ✅ 可以                    |

> **关键记忆点**：如果把UE比作一部电影，UObject是"剧本纸张"（数据载体），AActor是"演员"（在场景中有位置、能行动、能被看到）。

---

## Actor的生命周期

一个Actor从诞生到消亡，经历以下完整生命阶段：

```
时间线 ──────────────────────────────────────────────────────────────→

[创建阶段]                              [运行阶段]              [销毁阶段]
    │                                       │                       │
    ├─ 1. 分配内存                          ├─ 6. BeginPlay()      ├─ 9. EndPlay()
    ├─ 2. 构造函数（C++构造）                ├─ 7. Tick() 每帧      ├─ 10. 销毁组件
    ├─ 3. PostInitializeComponents()        │    Tick() 每帧       ├─ 11. 释放内存
    ├─ 4. 加载序列化数据                     │    Tick() 每帧       │
    ├─ 5. PostLoad() / PostRegisterAllComp  │    Tick() 每帧       │
    └───────────────────────────────────    └─────────────────    └─────────────
                                           ↑
                                     BeginPlay只有一次！
                                    Tick()每帧执行（约60-120次/秒）
```

### 生命周期各阶段详解

```cpp
// ========== 阶段1-2：对象构造 ==========
// 当你在C++中用 SpawnActor 或拖入关卡时，首先调用构造函数

AMyActor::AMyActor()
{
    // ⚠️ 构造函数中只能做简单设置！
    // 这里还没有世界、没有其他Actor、没有GameMode
    // 只能：设置默认值、创建组件

    PrimaryActorTick.bCanEverTick = true;  // 允许Tick

    MyValue = 0;  // ✅ 设置默认值，OK
    // GetWorld() ← ❌ 这里还拿不到世界！会返回nullptr
}

// ========== 阶段3-5：初始化后处理 ==========
// PostInitializeComponents() 在所有组件创建完毕之后调用
// 这时可以安全地访问组件，但其他Actor可能还没创建完

void AMyActor::PostInitializeComponents()
{
    Super::PostInitializeComponents();  // 必须先调用父类

    // ✅ 这里可以访问自己的组件了
    // ❌ 仍然不应该依赖其他Actor的存在
}

// ========== 阶段6：BeginPlay ==========
// BeginPlay是游戏逻辑的真正起点！此时世界已经就绪
// 所有Actor都已创建完毕，可以安全地相互引用

void AMyActor::BeginPlay()
{
    Super::BeginPlay();  // ← 必须调用父类！

    // ✅ 可以做的事情：
    // - 获取世界：GetWorld()
    // - 查找其他Actor：GetAllActorsOfClass()
    // - 绑定事件/委托
    // - 初始化游戏逻辑
    // - 设置初始Transform
    // - 播放声音/动画

    UE_LOG(LogTemp, Log, TEXT("我的Actor开始工作了！位置：%s"),
           *GetActorLocation().ToString());
}

// ========== 阶段7：Tick（每帧） ==========
// 每秒调用约60-120次（取决于帧率），用于逐帧逻辑

void AMyActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);  // ← 必须调用父类！

    // DeltaTime = 上一帧到这一帧的时间（秒）
    // 例如60fps时，DeltaTime ≈ 0.0167秒

    // 每秒移动100单位（不受帧率影响）
    FVector NewLocation = GetActorLocation();
    NewLocation.X += 100.0f * DeltaTime;
    SetActorLocation(NewLocation);
}

// ========== 阶段9-11：销毁 ==========
void AMyActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Super::EndPlay(EndPlayReason);  // ← 必须调用父类！

    // EndPlayReason 告诉你为什么结束了：
    // EEndPlayReason::Destroyed         → 主动调用了Destroy()
    // EEndPlayReason::LevelTransition   → 切换关卡
    // EEndPlayReason::EndPlayInEditor   → 编辑器停止运行
    // EEndPlayReason::RemovedFromWorld  → 从世界移除
    // EEndPlayReason::Quit              → 游戏退出

    UE_LOG(LogTemp, Log, TEXT("Actor结束，原因：%d"), (int32)EndPlayReason);
}
```

---

## Actor的核心方法

### BeginPlay — 游戏开始的入口

```cpp
// MyActor.h
UCLASS()
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()

protected:
    // 重写BeginPlay
    virtual void BeginPlay() override;
};

// MyActor.cpp
void AMyActor::BeginPlay()
{
    // 第一步：永远先调用父类！
    Super::BeginPlay();
    //                     ↑
    // 这是铁律！忘记调用父类会导致各种奇怪的bug
    // 比如Tick不工作、组件没初始化完成等

    // 第二步：你的游戏逻辑
    // ...
}
```

### Tick — 每帧执行

```cpp
// MyActor.h
UCLASS()
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    AMyActor()
    {
        // ⚠️ 必须在这里开启Tick！否则Tick不会执行
        PrimaryActorTick.bCanEverTick = true;
        //                            ↑
        // 设为true表示"这个Actor需要每帧更新"
        // 默认是false以节省性能（绝大多数静态物体不需要Tick）
    }

protected:
    virtual void Tick(float DeltaTime) override;
    //                       ↑
    // DeltaTime: 距离上一帧的时间（秒）
    // 用它来保证不同帧率下移动速度一致
};

// MyActor.cpp
void AMyActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 使用DeltaTime保证帧率无关的运动
    // 60fps: DeltaTime ≈ 0.0167 → 每帧移动1.67单位
    // 30fps: DeltaTime ≈ 0.0333 → 每帧移动3.33单位
    // 结果：每秒都移动100单位！
    AddActorLocalOffset(FVector(100.0f, 0.0f, 0.0f) * DeltaTime);
}
```

#### Tick的优化选项

```cpp
AMyActor::AMyActor()
{
    PrimaryActorTick.bCanEverTick = true;          // ⚠️ 总开关

    // 性能优化选项：
    PrimaryActorTick.TickInterval = 0.0f;          // Tick间隔（0=每帧）
    // 设为0.5f = 每0.5秒Tick一次（每秒2次），角色移动不推荐
    // 设为0.1f = 每秒Tick 10次，适合AI决策等不需要每帧的逻辑

    PrimaryActorTick.TickGroup = TG_PrePhysics;    // Tick在哪个阶段执行
    // TG_PrePhysics  → 物理模拟前（默认）
    // TG_DuringPhysics → 物理模拟中
    // TG_PostPhysics  → 物理模拟后
    // TG_PostUpdateWork → 所有更新完成后

    // ❌ 错误：不需要Tick时也开启
    // PrimaryActorTick.bCanEverTick = true;  // 一棵静态的树不需要Tick！
}
```

### EndPlay — 销毁时的清理

```cpp
void AMyActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Super::EndPlay(EndPlayReason);

    // 根据销毁原因做不同处理
    switch (EndPlayReason)
    {
    case EEndPlayReason::Destroyed:
        // 手动调用Destroy()触发的销毁
        // 正常游戏逻辑：敌人死亡、道具被捡起等
        break;

    case EEndPlayReason::LevelTransition:
        // 切换关卡导致的销毁
        // 当前关卡中所有Actor都会被销毁
        break;

    case EEndPlayReason::RemovedFromWorld:
        // 从世界中被移除（如流式关卡卸载）
        break;

    case EEndPlayReason::Quit:
        // 游戏退出
        // 不要在这里做耗时操作！
        break;
    }
}
```

### Destroy — 主动销毁Actor

```cpp
// 销毁一个Actor
void AMyActor::Die()
{
    // ✅ 正确：调用Destroy()
    Destroy();
    //       ↑
    // 调用Destroy()后，Actor进入"待销毁"状态
    // 它不会在本帧立即消失，但：
    // - IsValid(Actor) 会返回 false
    // - 不能再被查找（GetAllActorsOfClass不会返回它）
    // - 在下一帧的GC中真正释放内存

    // ❌ 错误：对可能已经待销毁的Actor再次调用Destroy()
    // Destroy();  // 第二次调用，危险！

    // ❌ 错误：调用delete
    // delete this;  // UE的对象由GC管理，不能delete！
}

// 安全检查：Actor是否有效
void AMyActor::CheckSafety(AActor* OtherActor)
{
    // ✅ 安全检查：IsValid 同时检查 nullptr 和"待销毁"
    if (IsValid(OtherActor))
    {
        // 安全使用
        OtherActor->SetActorLocation(FVector::ZeroVector);
    }
}
```

---

## Actor的Transform系统

Transform 由一个Actor在3D空间中的**位置、旋转、缩放**组成。在UE中，Transform可以表示为：

```
FTransform = FVector(位置) + FQuat(旋转-四元数) + FVector(缩放)
          ≈ FVector(位置) + FRotator(旋转-欧拉角) + FVector(缩放)

FTransform:  完整变换，包含所有三个，内部使用四元数（精确、无万向节锁）
FVector:     位置坐标（X=前, Y=右, Z=上）
FRotator:    旋转角（Pitch=俯仰, Yaw=偏航, Roll=翻滚）
```

### UE的坐标系统

```
        Z(上)
        │
        │
        │
        └────────── Y(右)
       /
      /
     /
    X(前)

左手坐标系！（拇指=X, 食指=Y, 中指=Z）
Pitch = 绕Y轴旋转（点头）
Yaw   = 绕Z轴旋转（摇头）
Roll  = 绕X轴旋转（歪头）
```

### 位置操作

```cpp
// ===== 获取位置 =====
FVector MyLocation = GetActorLocation();
//             X     Y     Z
// 返回例如： (100, 200, 50)

// UE_LOG打印位置
UE_LOG(LogTemp, Log, TEXT("我的位置：%s"), *MyLocation.ToString());
// 输出：我的位置：X=100.000 Y=200.000 Z=50.000

// ===== 设置位置（世界坐标）=====
SetActorLocation(FVector(500.0f, 0.0f, 100.0f));
//                            X      Y      Z
// 将Actor移动到世界坐标(500, 0, 100)

// ===== 相对移动 =====
// 在当前坐标基础上偏移
AddActorLocalOffset(FVector(10.0f, 0.0f, 0.0f));
// 向自己的前方移动10个单位

AddActorWorldOffset(FVector(10.0f, 0.0f, 0.0f));
// 向世界X轴方向移动10个单位（不关心Actor朝向）

// ===== 从A移动到B =====
FVector Start = FVector(0, 0, 0);
FVector End = FVector(1000, 0, 0);

// 先设到起点
SetActorLocation(Start);

// 计算方向向量
FVector Direction = (End - Start).GetSafeNormal();
// GetSafeNormal(): 归一化（长度变为1），安全版本（零向量返回(0,0,0)）

// 每秒移动200单位
float Speed = 200.0f;
FVector NewPos = GetActorLocation() + Direction * Speed * DeltaTime;
SetActorLocation(NewPos);
```

### 旋转操作

```cpp
// ===== 获取旋转 =====
FRotator MyRotation = GetActorRotation();
// 返回例如：Pitch=0.0, Yaw=90.0, Roll=0.0
// 表示Actor面朝Y轴正方向（右）

// ===== 设置旋转 =====
SetActorRotation(FRotator(0.0f, 180.0f, 0.0f));
//                         Pitch  Yaw    Roll
// 面朝X轴负方向（后方）

// ===== 旋转某个角度 =====
// 绕Z轴旋转90度（水平转向）
AddActorLocalRotation(FRotator(0.0f, 90.0f, 0.0f));

// ===== 让Actor看向某个位置 =====
FVector TargetLocation(1000.0f, 500.0f, 0.0f);
FVector LookDirection = TargetLocation - GetActorLocation();
FRotator LookRotation = LookDirection.Rotation();
//                       ↑
// FVector::Rotation() 将方向向量转为FRotator
SetActorRotation(LookRotation);

// 或者用现成方法（更方便）：
SetActorRotation(
    (TargetLocation - GetActorLocation()).Rotation()
);

// ===== 常用方向向量 =====
FVector Forward = GetActorForwardVector();  // Actor的前方（X轴方向）
FVector Right   = GetActorRightVector();   // Actor的右方（Y轴方向）
FVector Up      = GetActorUpVector();      // Actor的上方（Z轴方向）

// 用法：让Actor向前移动
FVector ForwardMove = GetActorForwardVector() * Speed * DeltaTime;
AddActorWorldOffset(ForwardMove);
```

### 缩放操作

```cpp
// ===== 获取缩放 =====
FVector MyScale = GetActorScale3D();
// 返回例如：(1.0, 1.0, 1.0)  ← 原始大小
//          (2.0, 2.0, 2.0)  ← 两倍大小
//          (1.0, 1.0, 0.5)  ← Z轴方向压扁一半

// ===== 设置缩放 =====
SetActorScale3D(FVector(2.0f, 2.0f, 2.0f));
// 将Actor放大2倍

// ===== 获取完整Transform =====
FTransform MyTransform = GetActorTransform();
// FTransform 包含：位置 + 旋转（四元数）+ 缩放
// 比分别获取三个值更高效

// 分别访问Transform的各个部分
FVector    Location = MyTransform.GetLocation();
FRotator   Rotation = MyTransform.Rotator();    // 转为欧拉角
FQuat      QuatRot  = MyTransform.GetRotation(); // 获取四元数
FVector    Scale    = MyTransform.GetScale3D();

// ===== 设置完整Transform =====
FTransform NewTransform(
    FRotator(0, 90, 0),         // 旋转
    FVector(100, 200, 50),       // 位置
    FVector(1, 1, 2)             // 缩放
);
SetActorTransform(NewTransform);
```

### ❌ 常见Transform错误

```cpp
// ❌ 错误1：不理解SetActorLocation的返回值
// SetActorLocation(NewLocation, bSweep, SweepHitResult, Teleport)
// 返回bool表示移动是否成功（如果开启Sweep并被阻挡，可能返回false）
bool bSuccess = SetActorLocation(NewLocation, false, nullptr, ETeleportType::None);
if (!bSuccess)
{
    // 关闭Sweep时通常会直接设置位置；开启Sweep时可能因为阻挡而无法到达目标点
    // 不要仅凭返回值判断"是否移动了"
}

// ❌ 错误2：在构造函数中调用GetActorLocation()
AMyActor::AMyActor()
{
    FVector Loc = GetActorLocation();  // 总是(0,0,0)！还没被放置
}

// ❌ 错误3：直接修改FRotator的分量
FRotator Rot = GetActorRotation();
Rot.Pitch += 10.0f;  // 这不会影响Actor！
// 需要调用 SetActorRotation(Rot) 才会生效

// ✅ 正确做法：
FRotator Rot = GetActorRotation();
Rot.Pitch += 10.0f;
SetActorRotation(Rot);
```

---

## RootComponent的概念和重要性

**RootComponent** 是每个Actor的"根"，它是Actor在空间中的锚点。

```cpp
// 每一个Actor都有一个RootComponent
// RootComponent决定了Actor的Transform（位置、旋转、缩放）

// 当你调用 GetActorLocation() 时，底层实际是：
FVector AActor::GetActorLocation() const
{
    // 内部实现等价于：
    return RootComponent->GetComponentLocation();
    //     ↑
    // Actor的位置 = RootComponent的位置！
}
```

### RootComponent必须满足的条件

```
RootComponent必须是 USceneComponent 或其子类
                    ↑
        因为只有SceneComponent才有Transform！

❌ 不能是 UActorComponent（纯逻辑组件，无Transform）
✅ 可以是 USceneComponent、UPrimitiveComponent、UStaticMeshComponent等
```

### 设置RootComponent

```cpp
// MyActor.h
UCLASS()
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    AMyActor();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    USceneComponent* DefaultSceneRoot;  // ← 作为RootComponent

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* MyMesh;       // ← 挂在RootComponent下
};

// MyActor.cpp
AMyActor::AMyActor()
{
    // ===== 步骤1：创建RootComponent =====
    DefaultSceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("DefaultSceneRoot"));
    //                                      ↑                  ↑
    //                          必须是SceneComponent子类    内部名称（用于序列化）
    RootComponent = DefaultSceneRoot;
    //    ↑
    // 关键！告诉UE："这个组件是我的根"

    // ===== 步骤2：创建子组件 =====
    MyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MyMesh"));

    // ===== 步骤3：将子组件挂到RootComponent下 =====
    MyMesh->SetupAttachment(DefaultSceneRoot);
    //       ↑
    // "你的父组件是DefaultSceneRoot"
    // 这样MyMesh的Transform就是相对于RootComponent的
}
```

### 为什么RootComponent这么重要？

```
没有RootComponent：
  Actor { }  ← 空壳，在场景中没有位置，无法被渲染

有RootComponent：
  Actor {
      RootComponent (USceneComponent)    ← 代表Actor在空间中的位置
      ├── MeshComponent                  ← 模型（相对偏移）
      ├── CollisionComponent             ← 碰撞体（相对偏移）
      └── AudioComponent                 ← 声音源（相对偏移）
  }

当Actor移动时：
  SetActorLocation(...) → 实际改变的是 RootComponent 的位置
  → 子组件跟着移动（因为它们挂载在RootComponent下）
```

---

## 获取世界：GetWorld()

```cpp
// GetWorld() 返回 Actor 所在的 UWorld 对象
// UWorld = 当前游戏"世界"，包含所有关卡、所有Actor、物理引擎等

void AMyActor::BeginPlay()
{
    Super::BeginPlay();

    // ✅ 在BeginPlay及之后，GetWorld()有效
    UWorld* World = GetWorld();
    if (World)
    {
        UE_LOG(LogTemp, Log, TEXT("世界名称：%s"), *World->GetName());

        // 通过World可以获取很多全局信息：
        // World->GetAuthGameMode()     → 服务器端的GameMode
        // World->GetFirstPlayerController() → 玩家控制器
        // World->GetTimeSeconds()      → 游戏开始后的时间（秒）
        // World->SpawnActor<...>()     → 生成新的Actor
    }

    // ❌ 在构造函数中 GetWorld() 返回 nullptr！
    // 因为此时Actor还没被放入世界
}

// ❌ 常见错误
AMyActor::AMyActor()
{
    UWorld* World = GetWorld();  // ← nullptr！
    // World->SpawnActor...  → 崩溃！
}
```

---

## Actor的标签系统

Actor可以通过字符串标签进行标记和查找，这是UE中非常实用的功能。

```cpp
// ===== 添加标签 =====
void AMyActor::BeginPlay()
{
    Super::BeginPlay();

    // 添加标签（可以在编辑器中添加，也可以在代码中添加）
    Tags.Add(FName(TEXT("Enemy")));
    Tags.Add(FName(TEXT("Melee")));
    Tags.Add(FName(TEXT("BossLevel")));

    // Tags 是一个 TArray<FName> 成员变量
    // 每个Actor都可以有任意数量的标签

    // ⚠️ 注意：使用 FName 不是 FString！
    // FName("hello") 和 FName("Hello") 是相同的（不区分大小写）
}

// ===== 检查标签 =====
bool AMyActor::IsEnemy() const
{
    // 方法1：ActorHasTag（UFunction，蓝图可调用）
    return ActorHasTag(FName(TEXT("Enemy")));
    //     ↑
    // 简单直接，推荐使用

    // 方法2：手动遍历Tags数组
    return Tags.Contains(FName(TEXT("Enemy")));
}
```

### 标签的实际用途

```cpp
// ===== 场景1：范围伤害只影响敌人 =====
void AMyActor::ExplosionDamage(float Radius, float Damage)
{
    // 找到范围内的所有Actor
    TArray<AActor*> NearbyActors;
    // ... 碰撞检测找到附近Actor ...

    for (AActor* Actor : NearbyActors)
    {
        // 只伤害带有"Enemy"标签的Actor
        if (Actor && Actor->ActorHasTag(FName(TEXT("Enemy"))))
        {
            // 对敌人造成伤害
            // Actor->TakeDamage(Damage, ...);
        }

        // ✅ 玩家没有"Enemy"标签，不会被误伤
    }
}

// ===== 场景2：根据不同标签执行不同逻辑 =====
void AMyActor::InteractWith(AActor* Target)
{
    if (Target->ActorHasTag(TEXT("Door")))
    {
        // 开门动画
    }
    else if (Target->ActorHasTag(TEXT("Pickup")))
    {
        // 拾取道具
    }
    else if (Target->ActorHasTag(TEXT("NPC")))
    {
        // 开始对话
    }
    else if (Target->ActorHasTag(TEXT("QuestObjective")))
    {
        // 完成任务目标
    }
}
```

---

## 查找Actor

在游戏中经常需要找到特定的Actor（例如：AI需要找到玩家、门需要找到钥匙等）。

### 方法1：GetAllActorsOfClass — 获取某类型的所有Actor

```cpp
void AMyActor::FindAllEnemies()
{
    UWorld* World = GetWorld();
    if (!World) return;

    // 查找场景中所有 AEnemyCharacter 类型的Actor
    TArray<AActor*> FoundActors;
    UGameplayStatics::GetAllActorsOfClass(
        World,                      // 在哪个世界查找
        AEnemyCharacter::StaticClass(), // 查找什么类型
        FoundActors                 // 输出：找到的Actor数组
    );

    UE_LOG(LogTemp, Log, TEXT("找到了 %d 个敌人"), FoundActors.Num());

    for (AActor* Actor : FoundActors)
    {
        AEnemyCharacter* Enemy = Cast<AEnemyCharacter>(Actor);
        if (Enemy)
        {
            UE_LOG(LogTemp, Log, TEXT("敌人：%s，位置：%s"),
                   *Enemy->GetName(),
                   *Enemy->GetActorLocation().ToString());
        }
    }
}

// ⚠️ 性能警告：GetAllActorsOfClass 会遍历整个关卡的所有Actor
// 不要在Tick中频繁调用！
// ✅ 在BeginPlay中调用一次，缓存结果
// ❌ 在Tick中每秒调用60次 ← 严重的性能问题
```

### 方法2：GetActorOfClass — 获取一个Actor

```cpp
void AMyActor::FindGameMode()
{
    UWorld* World = GetWorld();
    if (!World) return;

    // 获取当前世界的GameMode（只在服务器端有效）
    AGameModeBase* GameMode = World->GetAuthGameMode();

    if (GameMode)
    {
        UE_LOG(LogTemp, Log, TEXT("找到了GameMode：%s"), *GameMode->GetName());
    }
}

// GetActorOfClass vs GetAllActorsOfClass：
// GetActorOfClass:  返回找到的第一个（性能更好，找到就停止）
// GetAllActorsOfClass: 返回所有（需要全部遍历完）
```

### 方法3：TActorIterator — C++迭代器方式

```cpp
void AMyActor::FindEnemiesWithIterator()
{
    UWorld* World = GetWorld();
    if (!World) return;

    // TActorIterator 是UE提供的C++迭代器
    // 比GetAllActorsOfClass更高效（不需要构造TArray）

    for (TActorIterator<AEnemyCharacter> It(World); It; ++It)
    //      ↑                                        ↑     ↑
    //  模板参数：要找的类型              只要还有就继续  下一个
    {
        AEnemyCharacter* Enemy = *It;  // *It 获取当前Actor指针

        // 跳过待销毁的Actor
        if (!IsValid(Enemy)) continue;

        UE_LOG(LogTemp, Log, TEXT("找到敌人：%s，距离：%.2f"),
               *Enemy->GetName(),
               FVector::Dist(GetActorLocation(), Enemy->GetActorLocation()));
    }
}
```

### 方法4：通过Tag查找

```cpp
void AMyActor::FindActorsByTag()
{
    // 先找到所有Actor，再过滤Tag
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GetWorld(), AActor::StaticClass(), AllActors);

    for (AActor* Actor : AllActors)
    {
        if (Actor->ActorHasTag(FName(TEXT("Objective"))))
        {
            // 找到了带有"Objective"标签的Actor
            UE_LOG(LogTemp, Log, TEXT("任务目标：%s"), *Actor->GetName());
        }
    }
}
```

---

## 实际的游戏场景示例

### 完整的旋转展示物Actor

```cpp
// ========== DisplayItem.h ==========
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "DisplayItem.generated.h"

UCLASS()
class MYGAME_API ADisplayItem : public AActor
{
    GENERATED_BODY()

public:
    ADisplayItem();

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    // ===== 组件 =====
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    class UStaticMeshComponent* ItemMesh;  // 显示模型

    // ===== 可配置属性 =====
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Display")
    float RotationSpeed = 45.0f;  // 每秒旋转45度（编辑器可调）

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Display")
    float BobSpeed = 2.0f;  // 上下浮动频率

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Display")
    float BobHeight = 10.0f;  // 上下浮动幅度（厘米）

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Display")
    bool bAutoDestroy = false;  // 是否自动销毁

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Display",
              meta = (EditCondition = "bAutoDestroy"))
    float DestroyAfterSeconds = 10.0f;  // 多少秒后自动销毁

private:
    FVector StartLocation;  // 初始位置（用于上下浮动计算）
    float ElapsedTime;      // 已经过的时间
};

// ========== DisplayItem.cpp ==========
#include "DisplayItem.h"
#include "Components/StaticMeshComponent.h"

ADisplayItem::ADisplayItem()
{
    // 开启Tick
    PrimaryActorTick.bCanEverTick = true;

    // 创建RootComponent
    // 使用一个USceneComponent做根（轻量，不需要渲染）
    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = Root;

    // 创建显示用的Mesh组件，挂在Root下
    ItemMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ItemMesh"));
    ItemMesh->SetupAttachment(Root);
    // Mesh挂在Root下，这样Root旋转时Mesh跟着转
}

void ADisplayItem::BeginPlay()
{
    Super::BeginPlay();

    // 记录初始位置（用于上下浮动）
    StartLocation = GetActorLocation();

    UE_LOG(LogTemp, Log, TEXT("展示物 %s 已激活"), *GetName());

    // 按Tag分类
    if (Tags.Contains(FName(TEXT("Treasure"))))
    {
        UE_LOG(LogTemp, Log, TEXT("这是一个宝箱类展示物"));
    }
}

void ADisplayItem::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 累加时间
    ElapsedTime += DeltaTime;

    // ===== 1. 旋转：绕Z轴自转 =====
    // 使用AddActorLocalRotation做相对旋转
    AddActorLocalRotation(FRotator(0.0f, RotationSpeed * DeltaTime, 0.0f));
    //                                  Pitch    Yaw(绕Z轴)       Roll

    // ===== 2. 上下浮动（正弦波） =====
    // sin函数在-1到1之间波动，乘以BobHeight控制幅度
    float BobOffset = FMath::Sin(ElapsedTime * BobSpeed) * BobHeight;
    //  FMath::Sin = 数学sin函数           ↑ 时间是弧度制的等价物

    // 设置新位置：初始位置 + Z轴偏移
    FVector NewLocation = StartLocation;
    NewLocation.Z += BobOffset;  // 只在Z轴（上下）方向浮动
    SetActorLocation(NewLocation);

    // ===== 3. 自动销毁 =====
    if (bAutoDestroy && ElapsedTime >= DestroyAfterSeconds)
    {
        Destroy();
        UE_LOG(LogTemp, Log, TEXT("展示物 %s 已自动销毁"), *GetName());
    }
}

void ADisplayItem::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Super::EndPlay(EndPlayReason);

    UE_LOG(LogTemp, Log, TEXT("展示物 %s 结束，原因：%d"), *GetName(), (int32)EndPlayReason);
}
```

### 编辑器配置步骤

```
1. 在编辑器中创建一个基于 ADisplayItem 的蓝图类：
   右键 → Blueprint Class → 选择 DisplayItem 为父类 → 命名 "BP_DisplayItem"

2. 给 ItemMesh 分配一个静态模型：
   打开蓝图 → 选择 ItemMesh → Static Mesh 选一个模型（如 SM_Cube）

3. 调整参数：
   - Rotation Speed = 45（每秒转45度）
   - Bob Speed = 2
   - Bob Height = 10
   - Auto Destroy = false

4. 将蓝图拖入关卡，运行游戏 → 你会看到一个旋转+上下浮动的物体！
```

---

## 完成检查清单

- [ ] 能用自己的话解释 AActor 和 UObject 的区别
- [ ] 能画出 Actor 生命周期的时间线（创建→BeginPlay→Tick→EndPlay→销毁）
- [ ] 知道 BeginPlay 和构造函数的区别（BeginPlay有World，构造函数没有）
- [ ] 知道 DeltaTime 的作用（帧率无关运动）
- [ ] 能在代码中使用 GetActorLocation / SetActorLocation
- [ ] 理解 RootComponent 是什么，知道为什么它是必须的
- [ ] 知道 GetWorld() 什么时候可以用（BeginPlay之后），什么时候不可以用（构造函数）
- [ ] 能给 Actor 添加标签并在代码中检查标签
- [ ] 知道如何查找场景中的 Actor（三种方法）
- [ ] 知道为什么不能在 Tick 中频繁调用 GetAllActorsOfClass
- [ ] 能手写一个简单的旋转+上下浮动的Actor

---

> **下一节**：[4.2 Component体系](./02-Component体系.md) — 深入理解Actor中的组件系统，学习如何用组件组合出复杂的功能。
