# 4.2 Component体系：Actor的功能模块

> **目标**：理解Component在UE中的角色，掌握从UActorComponent到UPrimitiveComponent的继承层次，学会创建、配置和管理各种组件。

---

## Component是什么？

**Component（组件）** 是附加在Actor上的功能模块。如果把Actor比作一个"空容器"，Component就是装进容器里的一种种"功能"。

```
Actor = 空容器（只有位置）
  │
  ├── StaticMeshComponent    ← 显示一个模型（视觉功能）
  ├── SphereComponent        ← 球形碰撞体（碰撞功能）
  ├── AudioComponent         ← 播放声音（音频功能）
  ├── MovementComponent      ← 自动旋转（移动功能）
  └── HealthComponent        ← 管理血量（自定义逻辑功能）

结论：每一个Component负责一个独立的功能
"Actor是老板，Component是员工，每个员工只做一件事"
```

### Actor和Component的关系

```
┌──────────── Actor ────────────┐
│                                │
│   RootComponent                │  ← Actor在空间中的"根"
│   (USceneComponent)           │     所有有Transform的组件都挂在这里
│       │                        │
│       ├── StaticMesh           │  ← 显示模型
│       ├── CapsuleCollision     │  ← 碰撞胶囊体
│       ├── SpringArm            │  ← 弹簧臂（控制相机距离）
│       │   └── Camera           │  ← 相机（挂在弹簧臂下）
│       └── Audio                │  ← 播放声音
│                                │
│   MovementComponent            │  ← 纯逻辑组件（无Transform）
│   (直接挂在Actor上，不需要层级)
└────────────────────────────────┘
```

---

## Component的类层次结构

```
UObject                                  ← UE对象的根
└── UActorComponent                      ← 所有组件的基类
    │                                      （纯逻辑组件，无Transform）
    ├── UMovementComponent               ← 移动逻辑（旋转、弹射等）
    ├── UAudioComponent                  ← 音频播放
    ├── UInputComponent                  ← 输入绑定
    │
    └── USceneComponent                  ← 有Transform的组件
        │                                  （可以在空间中定位）
        ├── UCameraComponent             ← 相机
        ├── USpringArmComponent          ← 弹簧臂
        │
        └── UPrimitiveComponent          ← 可渲染+可碰撞的组件
            │                              （Primitive = 图元）
            ├── UStaticMeshComponent     ← 静态模型
            ├── USkeletalMeshComponent   ← 骨骼模型（角色动画）
            ├── UCapsuleComponent        ← 胶囊碰撞体
            ├── USphereComponent         ← 球形碰撞体
            ├── UBoxComponent            ← 盒形碰撞体
            └── UChildActorComponent     ← 子Actor组件
```

> **关键记忆点**：
>
> - `UActorComponent`：纯逻辑，看不见摸不着（如移动组件、输入组件）
> - `USceneComponent`：有位置，但看不见（如相机、弹簧臂）
> - `UPrimitiveComponent`：有位置 + 看得见 + 碰得到（如模型、碰撞体）

---

## UActorComponent — 纯逻辑组件

`UActorComponent` 是最基础的组件类型，它**没有Transform**，纯粹提供逻辑功能。

```cpp
// ========== HealthComponent.h ==========
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HealthComponent.generated.h"

// 声明一个委托（事件），当血量变化时广播
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnHealthChanged,           // 委托类型名
    float, CurrentHealth,       // 参数1：当前血量
    float, MaxHealth            // 参数2：最大血量
);

UCLASS(ClassGroup = (Custom), meta = (BlueprintSpawnableComponent))
//      ↑                                  ↑
// ClassGroup: 在编辑器的组件列表中归到哪个组
// BlueprintSpawnableComponent: 允许在蓝图中添加这个组件
class MYGAME_API UHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHealthComponent();

protected:
    virtual void BeginPlay() override;
    // 注意：UActorComponent 也有 BeginPlay！

public:
    // ===== 属性 =====
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Health")
    float MaxHealth = 100.0f;  // 最大血量

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Health")
    float CurrentHealth;  // 当前血量（不能超过MaxHealth）

    // ===== 事件 =====
    UPROPERTY(BlueprintAssignable, Category = "Health")
    FOnHealthChanged OnHealthChanged;  // 血量变化事件

    // ===== 方法 =====
    UFUNCTION(BlueprintCallable, Category = "Health")
    void TakeDamage(float DamageAmount);

    UFUNCTION(BlueprintCallable, Category = "Health")
    void Heal(float HealAmount);

    UFUNCTION(BlueprintPure, Category = "Health")
    float GetHealthPercent() const;  // 返回血量百分比（0.0 ~ 1.0）

    UFUNCTION(BlueprintPure, Category = "Health")
    bool IsDead() const;
};

// ========== HealthComponent.cpp ==========
#include "HealthComponent.h"

UHealthComponent::UHealthComponent()
{
    // 组件默认不Tick
    PrimaryComponentTick.bCanEverTick = false;
    //                                ↑
    // 血量组件不需要每帧更新，省性能
}

void UHealthComponent::BeginPlay()
{
    Super::BeginPlay();

    // 初始化当前血量为满血
    CurrentHealth = MaxHealth;
}

void UHealthComponent::TakeDamage(float DamageAmount)
{
    // 扣血（不能低于0）
    CurrentHealth = FMath::Clamp(CurrentHealth - DamageAmount, 0.0f, MaxHealth);
    //                        ↑
    // FMath::Clamp: 将值限制在 [0, MaxHealth] 范围内

    // 广播血量变化事件（蓝图可以绑定这个事件做UI更新等）
    OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);

    // 日志输出
    UE_LOG(LogTemp, Log, TEXT("%s 受到 %.1f 伤害，剩余血量：%.1f"),
           *GetOwner()->GetName(), DamageAmount, CurrentHealth);
    //    ↑
    // GetOwner() 返回这个组件所属的Actor
}

void UHealthComponent::Heal(float HealAmount)
{
    // 回血（不能超过最大值）
    CurrentHealth = FMath::Clamp(CurrentHealth + HealAmount, 0.0f, MaxHealth);

    OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);

    UE_LOG(LogTemp, Log, TEXT("%s 回复了 %.1f 血量，当前血量：%.1f"),
           *GetOwner()->GetName(), HealAmount, CurrentHealth);
}

float UHealthComponent::GetHealthPercent() const
{
    if (MaxHealth <= 0.0f) return 0.0f;
    return CurrentHealth / MaxHealth;
}

bool UHealthComponent::IsDead() const
{
    return CurrentHealth <= 0.0f;
}
```

### UActorComponent的特点

| 特点          | 说明                                    |
| ------------- | --------------------------------------- |
| 无Transform   | 不能放置在空间中，纯逻辑                |
| 有BeginPlay   | 和Actor一样有生命周期回调               |
| 有GetOwner()  | 可以获取它所属的Actor                   |
| 可选Tick      | `PrimaryComponentTick.bCanEverTick`控制 |
| 可被激活/停用 | `SetActive()`, `IsActive()`             |

---

## USceneComponent — 有Transform的组件

`USceneComponent` 继承了 `UActorComponent` 并添加了**Transform（位置、旋转、缩放）**。它本身不渲染任何东西，但可以在空间中定位，并且可以承载子组件。

```cpp
// 创建一个自定义的SceneComponent
// MySceneComponent.h
#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "MySceneComponent.generated.h"

UCLASS(ClassGroup = (Custom), meta = (BlueprintSpawnableComponent))
class MYGAME_API UMySceneComponent : public USceneComponent
{
    GENERATED_BODY()

public:
    UMySceneComponent();

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType,
                               FActorComponentTickFunction* ThisTickFunction) override;
    //              ↑
    // 注意：组件的Tick叫 TickComponent，不是 Tick！
    // 参数也不同：多了TickType和ThisTickFunction
};

// MySceneComponent.cpp
UMySceneComponent::UMySceneComponent()
{
    PrimaryComponentTick.bCanEverTick = true;

    // 设置相对Transform
    SetRelativeLocation(FVector(100.0f, 0.0f, 50.0f));
    //   ↑ 相对于父组件的位置偏移

    SetRelativeRotation(FRotator(0.0f, 45.0f, 0.0f));
    //   ↑ 相对于父组件的旋转偏移

    SetRelativeScale3D(FVector(2.0f, 2.0f, 2.0f));
    //   ↑ 相对于父组件的缩放
}

void UMySceneComponent::TickComponent(float DeltaTime, ELevelTick TickType,
                                       FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // 自转示例
    AddLocalRotation(FRotator(0.0f, 30.0f * DeltaTime, 0.0f));
    //  ↑ 相对于自身当前的旋转
}
```

### USceneComponent vs UActorComponent 关键区别

```cpp
// ❌ UActorComponent 没有位置
UActorComponent* CompA = GetOwner()->FindComponentByClass<UMyActorComponent>();
// CompA->GetComponentLocation();  ← 编译错误！UActorComponent没有这个方法

// ✅ USceneComponent 有位置
USceneComponent* CompB = Cast<USceneComponent>(GetRootComponent());
FVector Location = CompB->GetComponentLocation();  // 世界坐标
FVector RelativeLocation = CompB->GetRelativeLocation();  // 相对父组件的坐标

// ✅ USceneComponent 有层级关系
CompB->SetupAttachment(ParentComponent);  // 挂在父组件下
CompB->GetAttachChildren();               // 获取所有子组件
CompB->GetAttachParent();                 // 获取父组件
```

---

## UPrimitiveComponent — 可渲染和碰撞的组件

`UPrimitiveComponent` 继承自 `USceneComponent`，是最常用的组件类型，在空间中有Transform，可以被渲染（看得见），也可以参与物理碰撞（碰得到）。

```cpp
// UPrimitiveComponent 的核心能力

void MyFunction(UPrimitiveComponent* PrimComp)
{
    // ===== 1. 可见性控制 =====
    PrimComp->SetVisibility(true);        // 显示
    PrimComp->SetVisibility(false);       // 隐藏
    PrimComp->SetHiddenInGame(true);      // 游戏中隐藏（编辑器中仍可见）
    bool bVisible = PrimComp->IsVisible(); // 是否可见

    // ===== 2. 碰撞控制 =====
    PrimComp->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    // NoCollision         → 完全无碰撞（穿过一切）
    // QueryOnly           → 只触发Overlap/射线检测，无物理
    // PhysicsOnly         → 只有物理碰撞，不触发Overlap
    // QueryAndPhysics     → 两者都有（默认）

    PrimComp->SetCollisionObjectType(ECC_WorldDynamic);
    // ECC_WorldStatic   → 静态世界物体（墙壁、地板）
    // ECC_WorldDynamic  → 动态世界物体（可移动物体）
    // ECC_Pawn          → Pawn/角色
    // ECC_PhysicsBody   → 物理模拟物体

    PrimComp->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
    // ECR_Ignore  → 忽略（穿过）
    // ECR_Overlap → 重叠事件（不阻挡，但触发Overlap事件）
    // ECR_Block   → 阻挡（不能穿过，产生碰撞）
    // 以上三种响应类型的对比：

    // ===== 3. 物理模拟 =====
    PrimComp->SetSimulatePhysics(true);  // 开启物理模拟（物体会受重力下落）
    PrimComp->SetMassOverrideInKg(NAME_None, 50.0f);  // 设置质量（千克）
    PrimComp->AddImpulse(FVector(1000, 0, 0));        // 施加冲量
    PrimComp->AddForce(FVector(0, 0, 980));           // 施加持续力

    // ===== 4. 材质控制 =====
    PrimComp->SetMaterial(0, SomeMaterial);  // 设置槽位0的材质
    // 可以为同一个模型的不同区域设置不同材质
}
```

---

## 常用组件详解

### UStaticMeshComponent — 静态模型组件

最常用的组件，用于显示一个3D模型。

```cpp
// MyActor.h
UCLASS()
class MYGAME_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    AMyActor();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* MainMesh;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* SubMesh;  // 第二个模型（例如：底座 + 展示物）
};

// MyActor.cpp
AMyActor::AMyActor()
{
    // ===== 创建RootComponent =====
    // 方案A：用SceneComponent做根（轻量）
    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = Root;

    // 方案B：直接用StaticMeshComponent做根（常用）
    // MainMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MainMesh"));
    // RootComponent = MainMesh;

    // ===== 创建Mesh组件 =====
    MainMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MainMesh"));
    MainMesh->SetupAttachment(Root);  // 挂在Root下

    SubMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("SubMesh"));
    SubMesh->SetupAttachment(MainMesh);  // 挂在MainMesh下（会跟着MainMesh移动/旋转）

    // 设置相对位置（编辑器中的偏移）
    SubMesh->SetRelativeLocation(FVector(0.0f, 50.0f, 100.0f));
    // SubMesh在MainMesh上方100，右侧50的位置

    // ===== 常见配置 =====
    // MainMesh->SetStaticMesh(...);  // 加载一个StaticMesh资源
    // MainMesh->SetMaterial(0, ...); // 设置材质
    // MainMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);

    // ===== 常用加载StaticMesh的方式 =====
    // 方法1：构造函数中加载（硬引用，编译时就确定）
    static ConstructorHelpers::FObjectFinder<UStaticMesh> MeshAsset(
        TEXT("/Game/StarterContent/Shapes/Shape_Cube")
        //              ↑
        // 资源路径：/Game = Content目录
        // Shape_Cube 是StarterContent中的一个立方体模型
    );
    if (MeshAsset.Succeeded())
    {
        MainMesh->SetStaticMesh(MeshAsset.Object);
    }

    // 方法2：在编辑器中通过UPROPERTY暴露（推荐，灵活）
    // 见下面的UPROPERTY声明
    // UPROPERTY(EditAnywhere, Category = "Mesh")
    // UStaticMesh* MeshToUse;  // 在编辑器中拖入
}
```

### USkeletalMeshComponent — 骨骼模型组件

用于显示带骨骼动画的模型（角色、生物等）。

```cpp
// 基本用法
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
USkeletalMeshComponent* CharacterMesh;

// 构造函数中创建
CharacterMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("CharacterMesh"));
CharacterMesh->SetupAttachment(RootComponent);

// 播放动画
CharacterMesh->PlayAnimation(IdleAnim, true);  // true = 循环播放
// 或使用动画蓝图
CharacterMesh->SetAnimInstanceClass(UMyAnimBP::StaticClass());

// 骨骼空间操作
FVector BoneLocation = CharacterMesh->GetBoneLocation(
    FName(TEXT("head")),    // 骨骼名称
    EBoneSpaces::WorldSpace  // 世界空间还是骨骼空间
);
```

### UCapsuleComponent — 胶囊碰撞体

最常用于角色的碰撞体（人形角色用胶囊体比用盒子更合理）。

```cpp
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
UCapsuleComponent* CapsuleComp;

// 构造函数中创建
CapsuleComp = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Capsule"));
CapsuleComp->SetupAttachment(RootComponent);

// 调整胶囊体尺寸
CapsuleComp->SetCapsuleSize(
    34.0f,   // 半径（厘米）— 34cm大约是角色的半身宽
    88.0f    // 半高（厘米）— 88cm差不多是上半身高度
);
// 注意：半高 = 圆柱体部分的高度的一半（不包括两个半球）

// 示意图：
//     ╭───╮     ← 上半球（半径为半径）
//     │   │     ← 圆柱体（高度为 半高*2）
//     │   │
//     ╰───╯     ← 下半球（半径为半径）
// 总高度 = 半高*2 + 半径*2
```

### USphereComponent — 球形碰撞体

```cpp
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
USphereComponent* SphereCollision;

SphereCollision = CreateDefaultSubobject<USphereComponent>(TEXT("Sphere"));
SphereCollision->SetupAttachment(RootComponent);
SphereCollision->SetSphereRadius(100.0f);  // 半径100厘米 = 1米
```

### UBoxComponent — 盒形碰撞体

```cpp
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
UBoxComponent* BoxCollision;

BoxCollision = CreateDefaultSubobject<UBoxComponent>(TEXT("Box"));
BoxCollision->SetupAttachment(RootComponent);
BoxCollision->SetBoxExtent(FVector(50, 100, 30));
//              盒子的半尺寸  X=前/后, Y=右/左, Z=上/下
// 实际大小 = 半尺寸 * 2
// 即：X方向100cm, Y方向200cm, Z方向60cm
```

### UChildActorComponent — 子Actor组件

用于在一个Actor内嵌套另一个Actor。

```cpp
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
UChildActorComponent* ChildWeapon;

// 构造函数中创建
ChildWeapon = CreateDefaultSubobject<UChildActorComponent>(TEXT("ChildWeapon"));
ChildWeapon->SetupAttachment(RootComponent);

// 设置子Actor的类（在蓝图中或代码中设置）
ChildWeapon->SetChildActorClass(AWeapon::StaticClass());

// 获取子Actor实例
AActor* ChildActor = ChildWeapon->GetChildActor();
AWeapon* Weapon = Cast<AWeapon>(ChildActor);
if (Weapon)
{
    Weapon->Fire();  // 调用子Actor的方法
}
```

### URotatingMovementComponent — 旋转移动组件

```cpp
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
URotatingMovementComponent* RotatingMovement;

RotatingMovement = CreateDefaultSubobject<URotatingMovementComponent>(TEXT("RotatingMovement"));
// 注意：MovementComponent不需要SetupAttachment（它是纯逻辑组件）

// 配置旋转速度
RotatingMovement->RotationRate = FRotator(0.0f, 45.0f, 0.0f);
//                                         Pitch  Yaw   Roll
// 每秒绕Z轴旋转45度

// 配置摆动（PingPong）
RotatingMovement->PivotTranslation = FVector(0.0f, 0.0f, 50.0f);
// 在Z轴方向来回移动50单位

// ✅ 用这个组件比自己写Tick旋转更简单、性能更好
```

---

## 组件的层级关系

```cpp
// SetupAttachment 建立了组件的父子关系
// 子组件的Transform是相对于父组件的

void AMyActor::SetupComponentHierarchy()
{
    // ===== 创建层级 =====
    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = Root;

    Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
    Body->SetupAttachment(Root);  // Body是Root的子
    Body->SetRelativeLocation(FVector(0, 50, 100));
    // Body在Root的前方50、上方100处

    Head = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Head"));
    Head->SetupAttachment(Body);  // Head是Body的子（不是Root的子！）
    Head->SetRelativeLocation(FVector(0, 0, 50));
    // Head在Body的上方50处

    // ===== 最终效果 =====
    // 当Root移动时，Body和Head都跟着移动
    // 当Body移动/旋转时，Head跟着移动/旋转
    // 当Head移动时，不影响Root和Body

    // 层级图：
    // Root (0, 0, 0)
    //   └── Body (0, 50, 100)   ← 相对Root
    //         └── Head (0, 0, 50)  ← 相对Body
    //
    // Head的世界坐标 = Root位置 + Body相对位置 + Head相对位置
    //               = (0,0,0) + (0,50,100) + (0,0,50)
    //               = (0, 50, 150)
}
```

### 获取子组件和父组件

```cpp
void MyClass::NavigateHierarchy(USceneComponent* Comp)
{
    // 获取父组件
    USceneComponent* Parent = Comp->GetAttachParent();
    if (Parent)
    {
        UE_LOG(LogTemp, Log, TEXT("父组件：%s"), *Parent->GetName());
    }

    // 获取所有直接子组件
    TArray<USceneComponent*> Children;
    Comp->GetChildrenComponents(true, Children);
    //                           ↑ true = 包含所有后代（递归）
    //                           false = 只包含直接子组件

    UE_LOG(LogTemp, Log, TEXT("子组件数量：%d"), Children.Num());

    for (USceneComponent* Child : Children)
    {
        UE_LOG(LogTemp, Log, TEXT("  └── %s"), *Child->GetName());
    }

    // 获取组件在世界空间中的Transform（递归计算所有父级偏移）
    FVector WorldLocation = Comp->GetComponentLocation();
    FRotator WorldRotation = Comp->GetComponentRotation();
    FVector WorldScale = Comp->GetComponentScale();
}
```

---

## 获取组件

### FindComponentByClass vs GetComponentByClass

```cpp
void AMyActor::FindMyComponents()
{
    // ===== 方法1：GetComponentByClass（模板，推荐）=====
    UHealthComponent* Health1 = GetComponentByClass<UHealthComponent>();
    //                           ↑
    // 返回第一个匹配的组件，如果没找到返回nullptr
    // 这是最常用的方式

    if (Health1)
    {
        Health1->TakeDamage(10.0f);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("没有找到HealthComponent！"));
    }

    // ===== 方法2：FindComponentByClass =====
    // FindComponentByClass 和 GetComponentByClass 功能完全相同
    // 只是命名风格不同，本质一样
    UHealthComponent* Health2 = FindComponentByClass<UHealthComponent>();
    // GetComponentByClass 内部实际就调用 FindComponentByClass

    // ===== 方法3：获取特定父类型的组件 =====
    USceneComponent* FirstSceneComp = GetComponentByClass<USceneComponent>();
    // 这会返回第一个SceneComponent子类（可能是StaticMeshComponent等）

    // ===== 方法4：获取所有匹配组件 =====
    TArray<UStaticMeshComponent*> AllMeshes;
    GetComponents<UStaticMeshComponent>(AllMeshes);
    //   ↑ 获取所有StaticMeshComponent（包括子类）

    // ===== 方法5：通过名字获取 =====
    UActorComponent* NamedComp = FindComponentByName(TEXT("MyHealth"));
    // 按组件内部名称查找（CreateDefaultSubobject时设置的TEXT("...") ）
}
```

### 在不同对象上查找组件

```cpp
// 在另一个Actor上查找组件
void MyClass::FindComponentOnOtherActor(AActor* OtherActor)
{
    if (!IsValid(OtherActor)) return;

    // 查其他Actor上的组件（和查自己一样）
    UHealthComponent* Health = OtherActor->FindComponentByClass<UHealthComponent>();

    if (Health && !Health->IsDead())
    {
        Health->TakeDamage(25.0f);
    }
}

// ❌ 常见错误：没有判空就使用
void MyClass::BadExample(AActor* OtherActor)
{
    // ❌ 如果OtherActor是nullptr会崩溃
    // ❌ 如果FindComponentByClass返回nullptr也会崩溃
    OtherActor->FindComponentByClass<UHealthComponent>()->TakeDamage(10.0f);
    //  ↑ 链式调用，中间任何一步为nullptr就崩溃
}

// ✅ 正确做法：每一步都判空
void MyClass::GoodExample(AActor* OtherActor)
{
    if (!IsValid(OtherActor))
    {
        UE_LOG(LogTemp, Warning, TEXT("OtherActor无效"));
        return;
    }

    UHealthComponent* Health = OtherActor->FindComponentByClass<UHealthComponent>();
    if (!Health)
    {
        UE_LOG(LogTemp, Warning, TEXT("没有找到HealthComponent"));
        return;
    }

    Health->TakeDamage(10.0f);  // 安全！
}
```

---

## 组件创建：CreateDefaultSubobject vs NewObject

```cpp
// ===== CreateDefaultSubobject（构造函数中使用）=====
AMyActor::AMyActor()
{
    // ✅ 正确：在构造函数中用 CreateDefaultSubobject
    MyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MyMesh"));
    //       ↑
    // CreateDefaultSubobject 的用途：
    // 1. 在构造函数中创建"默认子对象"（CDO的一部分）
    // 2. 会自动注册到Actor
    // 3. 编辑器可以序列化它（保存到关卡/蓝图）
    // 4. 引擎负责生命周期管理
}

// ===== NewObject（运行时使用）=====
void AMyActor::BeginPlay()
{
    Super::BeginPlay();

    // ✅ 正确：运行时动态创建用 NewObject
    UMyComponent* DynamicComp = NewObject<UMyComponent>(this);
    //                                                 ↑
    // Outer对象（通常是this/Actor），GC会据此追踪引用

    // ⚠️ NewObject创建的组件需要手动注册！
    DynamicComp->RegisterComponent();
    //             ↑
    // 告诉引擎"这个组件现在激活了"
    // 不调用RegisterComponent的话，组件虽然存在但不工作

    // ❌ 错误：在构造函数中使用NewObject
    // 构造时NewObject创建的组件不在CDO中，可能导致奇怪问题
}

// ===== 对比总结 =====
// CreateDefaultSubobject:  构造函数专用 | 自动注册 | 可序列化 | 编辑器可见
// NewObject:               运行时专用   | 手动注册 | 不可序列化 | 动态创建
```

---

## 组件的激活/停用

```cpp
void AMyActor::ManageComponentState()
{
    // ===== 激活组件 =====
    UHealthComponent* Health = FindComponentByClass<UHealthComponent>();
    if (Health)
    {
        Health->Activate(true);
        //       ↑ true = 同时重置（调用Reactivate）
        //       false = 仅激活（不重置状态）

        // 检查是否激活
        if (Health->IsActive())
        {
            UE_LOG(LogTemp, Log, TEXT("Health组件已激活"));
        }
    }

    // ===== 停用组件 =====
    Health->Deactivate();
    // 停用后：
    // - Tick不会执行
    // - 某些回调不会再触发
    // - 但组件仍然存在，可以重新激活

    // ===== 切换激活状态 =====
    Health->ToggleActive();  // 已激活→停用，已停用→激活

    // ===== 设置组件Tick状态 =====
    Health->SetComponentTickEnabled(false);  // 仅停止Tick
    // 组件本身仍然激活，其他功能正常，只是Tick不执行
    Health->SetComponentTickEnabled(true);   // 重新启用Tick

    // ===== 实际应用场景 =====
    // 场景1：玩家远离后停用远处敌人的AI组件（节省性能）
    // 场景2：进入过场动画时停用所有移动组件
    // 场景3：暂停菜单时停用所有输入组件
}
```

---

## 完整的Actor + 多层组件示例

下面是一个完整的"宝箱"Actor，展示了各种组件的组合使用：

```cpp
// ========== TreasureChest.h ==========
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TreasureChest.generated.h"

class UStaticMeshComponent;
class USphereComponent;
class URotatingMovementComponent;

UCLASS()
class MYGAME_API ATreasureChest : public AActor
{
    GENERATED_BODY()

public:
    ATreasureChest();

protected:
    virtual void BeginPlay() override;

    // ===== 组件声明 =====
    // 根组件（空SceneComponent，纯定位用）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    USceneComponent* BaseRoot;

    // 底座模型
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* BaseMesh;

    // 箱子本体
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* ChestBody;

    // 箱子盖（可以旋转打开的）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* ChestLid;

    // 球形碰撞体（检测玩家靠近）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    USphereComponent* InteractionSphere;

    // 宝箱内的金币（不断旋转）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    UStaticMeshComponent* GoldCoin;

    // 旋转组件（让金币旋转）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    URotatingMovementComponent* CoinRotation;

    // ===== 碰撞回调 =====
    UFUNCTION()
    void OnPlayerEnterRange(UPrimitiveComponent* OverlappedComp, AActor* OtherActor,
                            UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
                            bool bFromSweep, const FHitResult& SweepResult);

    UFUNCTION()
    void OnPlayerLeaveRange(UPrimitiveComponent* OverlappedComp, AActor* OtherActor,
                            UPrimitiveComponent* OtherComp, int32 OtherBodyIndex);
};

// ========== TreasureChest.cpp ==========
#include "TreasureChest.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SphereComponent.h"
#include "Components/SceneComponent.h"
#include "GameFramework/RotatingMovementComponent.h"

ATreasureChest::ATreasureChest()
{
    // ===== 1. 创建根组件 =====
    BaseRoot = CreateDefaultSubobject<USceneComponent>(TEXT("BaseRoot"));
    RootComponent = BaseRoot;  // 把它设为根

    // ===== 2. 创建底座 =====
    BaseMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BaseMesh"));
    BaseMesh->SetupAttachment(BaseRoot);  // 挂在根下
    // 底座不偏移，在原点

    // ===== 3. 创建箱子本体 =====
    ChestBody = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ChestBody"));
    ChestBody->SetupAttachment(BaseRoot);  // 也挂在根下
    ChestBody->SetRelativeLocation(FVector(0.0f, 0.0f, 50.0f));
    // 箱子本体在底座上方50cm

    // ===== 4. 创建箱子盖 =====
    ChestLid = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ChestLid"));
    ChestLid->SetupAttachment(ChestBody);  // 挂在箱子本体下！
    //       ↑ 这样当箱子本体移动时，盖子跟着移动
    ChestLid->SetRelativeLocation(FVector(0.0f, 0.0f, 30.0f));
    // 盖子在本体上方30cm

    // ===== 5. 创建碰撞体 =====
    InteractionSphere = CreateDefaultSubobject<USphereComponent>(TEXT("InteractionSphere"));
    InteractionSphere->SetupAttachment(BaseRoot);
    InteractionSphere->SetSphereRadius(200.0f);  // 2米范围
    InteractionSphere->SetCollisionResponseToAllChannels(ECR_Ignore);  // 忽略所有
    InteractionSphere->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);  // 只和Pawn重叠

    // ===== 6. 创建金币模型 =====
    GoldCoin = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("GoldCoin"));
    GoldCoin->SetupAttachment(ChestBody);  // 挂在箱子本体下
    GoldCoin->SetRelativeLocation(FVector(0.0f, 0.0f, 60.0f));
    // 金币在箱子内部（本体上方60cm）

    // ===== 7. 创建旋转组件 =====
    CoinRotation = CreateDefaultSubobject<URotatingMovementComponent>(TEXT("CoinRotation"));
    // 注意：MovementComponent不需要SetupAttachment！

    // ===== 层级结构总结 =====
    // BaseRoot (根)
    //   ├── BaseMesh (底座，原点)
    //   ├── ChestBody (箱子本体，Z+50)
    //   │   ├── ChestLid (盖子，相对本体Z+30)
    //   │   └── GoldCoin (金币，相对本体Z+60)
    //   └── InteractionSphere (碰撞体，半径200)
    // CoinRotation (纯逻辑组件，不参与层级)
}

void ATreasureChest::BeginPlay()
{
    Super::BeginPlay();

    // 绑定碰撞回调
    InteractionSphere->OnComponentBeginOverlap.AddDynamic(
        this, &ATreasureChest::OnPlayerEnterRange
    );
    //  ↑              ↑                 ↑
    // 碰撞组件      绑定对象      回调函数

    InteractionSphere->OnComponentEndOverlap.AddDynamic(
        this, &ATreasureChest::OnPlayerLeaveRange
    );

    // 让金币旋转
    CoinRotation->RotationRate = FRotator(0.0f, 90.0f, 0.0f);
    // 每秒绕Z轴旋转90度
}

void ATreasureChest::OnPlayerEnterRange(UPrimitiveComponent* OverlappedComp,
                                         AActor* OtherActor,
                                         UPrimitiveComponent* OtherComp,
                                         int32 OtherBodyIndex,
                                         bool bFromSweep,
                                         const FHitResult& SweepResult)
{
    UE_LOG(LogTemp, Log, TEXT("%s 进入了宝箱范围！"), *OtherActor->GetName());
    // 这里可以显示UI提示"按E打开宝箱"
}

void ATreasureChest::OnPlayerLeaveRange(UPrimitiveComponent* OverlappedComp,
                                         AActor* OtherActor,
                                         UPrimitiveComponent* OtherComp,
                                         int32 OtherBodyIndex)
{
    UE_LOG(LogTemp, Log, TEXT("%s 离开了宝箱范围"), *OtherActor->GetName());
    // 隐藏UI提示
}
```

---

## 完成检查清单

- [ ] 能解释 Component 和 Actor 的关系（容器 vs 功能模块）
- [ ] 能画出 Component 的类层次结构（UActorComponent → USceneComponent → UPrimitiveComponent）
- [ ] 知道 UActorComponent 和 USceneComponent 的区别（有没有Transform）
- [ ] 知道 UPrimitiveComponent 的三大能力（可见、碰撞、物理）
- [ ] 能在构造函数中用 CreateDefaultSubobject 创建组件
- [ ] 理解 SetupAttachment 的作用（建立父子层级关系）
- [ ] 知道 GetComponentByClass 和 FindComponentByClass 的用法
- [ ] 理解 CreateDefaultSubobject（构造时）和 NewObject（运行时）的区别
- [ ] 知道如何激活/停用组件
- [ ] 能手写一个包含多个组件的Actor（模型+碰撞体+移动组件）

---

> **上一节**：[4.1 AActor详解](./01-AActor详解.md)
> **下一节**：[4.3 生成与销毁](./03-生成与销毁.md) — 学习如何在运行时动态生成和销毁Actor。
