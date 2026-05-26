# 3.1 UObject系统：UE的基石

> **目标**：理解UObject是什么，为什么UE不用标准C++的对象模型，以及UObject提供了哪些"超能力"。

---

## 什么是UObject？

`UObject` 是UE中**大多数引擎对象类型的共同基类**，例如Actor、Component、Asset和Subsystem。它不是所有C++类型的基类：`FVector`、`FString`、`TArray`、Slate控件等很多类型并不继承`UObject`。可以把它理解为UE在标准C++之上构建的一套"增强对象系统"。

```
标准C++对象:                    UE对象:
┌──────────┐                  ┌──────────┐
│ 普通对象  │                  │ UObject  │
│          │                  │          │
│ • 数据   │                  │ • 数据   │
│ • 方法   │                  │ • 方法   │
│          │                  │ • 反射   │ ← 运行时知道自己的类型/属性/函数
│          │                  │ • GC     │ ← 自动垃圾回收
│ 局限性:  │                  │ • 序列化 │ ← 自动保存/加载
│ 无反射   │                  │ • 网络复制│ ← 多人游戏同步
│ 手动内存 │                  │ • 蓝图交互│ ← 蓝图可视化编辑
└──────────┘                  └──────────┘
```

### UObject提供的"超能力"

| 超能力                      | 含义                     | 对开发者的好处               |
| --------------------------- | ------------------------ | ---------------------------- |
| **反射（Reflection）**      | 运行时知道类的成员       | 编辑器细节面板自动显示属性   |
| **垃圾回收（GC）**          | 回收不可达的UObject对象  | UObject通常不用手动delete，但仍要正确保存引用 |
| **序列化（Serialization）** | 自动保存/加载对象        | 存档系统自动工作             |
| **网络复制（Replication）** | 按规则把指定状态同步到客户端 | 少写底层网络包，但仍要配置Replicated/RPC |
| **蓝图交互**                | C++类可在蓝图中使用      | 策划/美术也能使用你的C++代码 |
| **编辑器集成**              | 属性在编辑器中可视化编辑 | 调数值不用重新编译           |

---

## UObject的类层次结构

```
UObject                           ← 大多数UE对象系统类型的基类
├── UActorComponent               ← 组件的基类
│   ├── USceneComponent           ← 有Transform的组件
│   │   ├── UPrimitiveComponent   ← 可渲染/碰撞的组件
│   │   │   ├── UStaticMeshComponent
│   │   │   ├── USkeletalMeshComponent
│   │   │   └── ...
│   │   └── ...
│   └── UActorComponent（纯逻辑）
│       ├── UMovementComponent
│       └── ...
├── AActor                        ← 可放入场景的物体
│   ├── APawn                     ← 可被控制的Actor
│   │   ├── ACharacter            ← 人形角色（有骨骼、动画）
│   │   └── ...
│   └── ...
├── UGameInstance                 ← 游戏实例（跨关卡）
├── AGameModeBase / AGameMode     ← 游戏规则（它们也是Actor）
└── ...（数百种其他类型）
```

> **关键记忆点**：`UObject` → `UActorComponent` / `AActor` → 具体类。所有的魔法都从UObject开始。

---

## UObject的"出生证明"：你必须遵守的规则

要让一个类成为UObject的子类，必须遵守以下规则：

```cpp
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"  // UObject的头文件
#include "MyObject.generated.h"     // ⚠️ 必须是最后一个include！

// 规则1: 加 UCLASS() 宏
UCLASS()
class MYPROJECT_API UMyObject : public UObject  // 规则2: 类名以 U 开头
{
    GENERATED_BODY()  // 规则3: 必须有这个宏，且在类体最前面

public:
    UMyObject();  // 构造函数

    // 规则4: 需要被反射/序列化/GC识别的成员变量才加UPROPERTY
    UPROPERTY()
    int32 MyValue;

    // 规则5: 成员函数需要UFUNCTION（如果需要UE系统看到它）
    UFUNCTION()
    void MyFunction();
};
```

**五条规则总览：**

| 规则                       | 说明               | 忘记的后果               |
| -------------------------- | ------------------ | ------------------------ |
| 类名前缀 `U`               | UObject子类以U开头 | 编译警告                 |
| `UCLASS()` 宏              | 标记为UE类         | 不能用UE功能             |
| `GENERATED_BODY()`         | 生成反射代码       | 编译报错（几百个错误！） |
| `.generated.h` 最后include | UHT生成的文件      | 编译报错                 |
| `UPROPERTY()` 标记成员     | GC可追踪 + 反射可见 | UObject引用失去保护/编辑器不可见 |

---

## UObject对象创建规则

### ❌ 不能用什么

```cpp
// ❌ 不能用new创建UObject！
UMyObject* Obj = new UMyObject();  // 编译可能通过但运行时出问题

// ❌ 不能在栈上创建UObject
UMyObject StackObj;  // 编译报错！UObject不允许栈分配
```

### ✅ 必须用什么

```cpp
// 创建UObject的正确方式：

// 方法1：NewObject<T>() — 最常用
UMyObject* Obj = NewObject<UMyObject>();
// NewObject返回的UObject由UE的GC销毁，但你仍需要用UPROPERTY等方式保存强引用

// 方法2：NewObject带Outer（指定命名/生命周期上下文）
UMyObject* Obj = NewObject<UMyObject>(OuterActor);  // OuterActor提供命名/生命周期上下文
// 注意：Outer不是UPROPERTY的替代品；长期持有对象时仍要用UPROPERTY保存引用

// 方法3：CreateDefaultSubobject（仅在Actor/Component构造函数中）
UMyComponent* Comp = CreateDefaultSubobject<UMyComponent>(TEXT("MyComp"));
// 这个只能在构造函数中调用
```

---

## UObject的生命周期

```
创建 ──→ 使用中 ──→ 标记为垃圾 ──→ GC回收
                      ↑
          没有任何UPROPERTY指针指向它
          且没有任何强引用
```

关键理解：

```cpp
// ===== 安全：GC不会回收 =====
UPROPERTY()
UMyObject* SafePtr;  // UPROPERTY让GC知道"这个指针还在用"
SafePtr = NewObject<UMyObject>();
// SafePtr指向的对象不会被回收，直到SafePtr被设为nullptr或本身被销毁

// ===== 危险：GC可能回收 =====
UMyObject* DangerousPtr;  // 没有UPROPERTY！
DangerousPtr = NewObject<UMyObject>();
// GC可能在任何时候回收这个对象，DangerousPtr变成野指针！
// 下次访问DangerousPtr → 崩溃！
```

---

## 垃圾回收的判断逻辑

UE的GC使用**标记-清除（Mark and Sweep）**算法：

```
1. 从"根集"开始：
   - 所有AActor（在关卡中的）
   - 所有UPROPERTY标记的指针
   - 一些引擎内部对象

2. 沿着UPROPERTY指针链标记可达对象：
   A → UPROPERTY → B → UPROPERTY → C
   (A可达 → B可达 → C可达)

3. 清除所有不可达对象

4. 有UPROPERTY保护 = 可达 = 不会被回收
   没有UPROPERTY = 可能不可达 = 可能被回收！
```

> 如果你的UObject指针没有 `UPROPERTY()` 保护，它就是GC的猎物。

---

## 检查对象是否有效

```cpp
UMyObject* Obj = GetSomeObject();

// 方法1：IsValid（推荐，最安全）
if (IsValid(Obj))  // 检查指针不是nullptr且对象没有被标记为待回收
{
    Obj->DoSomething();
}

// 方法2：直接判空
if (Obj != nullptr)  // 只能检查空指针，不能检查"已标记为待回收"
{
    // 可能对象已经被标记回收但你不知道！
}

// 方法3：IsValidLowLevel（引擎内部用，不推荐）
if (Obj->IsValidLowLevel())
{
    // ...
}

// 总结：看到UObject指针就用 IsValid() 检查
```

---

## UObject的内存管理总结

| 场景            | 做法                                                 |
| --------------- | ---------------------------------------------------- |
| 持有UObject指针 | 必须 `UPROPERTY()`                                   |
| 创建UObject     | `NewObject<T>()`                                     |
| 创建组件        | `CreateDefaultSubobject<T>()`（构造函数中）          |
| 创建Actor       | `GetWorld()->SpawnActor<T>()`                        |
| 检查有效性      | `IsValid(Ptr)`                                       |
| 销毁Actor       | `Actor->Destroy()`                                   |
| 销毁组件        | `Comp->DestroyComponent()`                           |
| 销毁UObject     | `Obj->ConditionalBeginDestroy()`（通常不需要手动调） |

---

## 完成检查清单

- [ ] 能说出UObject的5个"超能力"
- [ ] 理解UE类必须遵循的5条规则
- [ ] 知道为什么不能用new创建UObject
- [ ] 理解UPROPERTY对GC保护的作用
- [ ] 能用NewObject创建UObject
- [ ] 能用IsValid检查UObject有效性
