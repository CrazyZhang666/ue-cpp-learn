# 7.1 Enhanced Input System 概述

> **目标**：理解什么是Enhanced Input System，它为什么取代了旧输入系统，以及它的核心工作原理。

---

## 为什么需要 Enhanced Input System？

在UE5之前，UE使用了一套被称为"旧输入系统"（Legacy Input System）的方案。虽然它能工作，但随着游戏越来越复杂，问题也越来越明显：

### 旧输入系统的痛点

| 痛点 | 描述 | 影响 |
|------|------|------|
| **硬编码键位** | 输入绑定用 `ActionMappings` 和 `AxisMappings` 写在 `DefaultInput.ini` 里 | 玩家无法改键，改键需要改配置文件 |
| **耦合严重** | C++代码直接依赖具体的按键名 `"Jump"` `"MoveForward"` | 改一个输入名需要全局搜索替换 |
| **无优先级** | 多个输入响应同时触发时，无法控制谁"赢" | 开车时还能开枪——分不清上下文 |
| **无组合键** | 不支持 `Shift+E` `Ctrl+W` 这类组合键 | 键位不够用，只能妥协 |
| **手柄支持差** | 键盘/鼠标/手柄的处理逻辑混在一起 | 想做好手柄体验需要写大量代码 |
| **无输入修饰** | 无法在数据层面处理死区、平滑、缩放 | 每个项目都要手写这些逻辑 |

> **一句话总结旧输入系统的问题**：它把"物理按键"和"游戏动作"绑死在一起，缺乏中间层来做灵活映射。

### Enhanced Input System 的解决方案

Enhanced Input System 在"物理按键"和"游戏动作"之间加入了**多层抽象**：

```
旧输入系统:
  按键 ──────────────────────────→ 游戏函数
  (直接绑定，无中间层)

Enhanced Input System:
  按键 → InputMappingContext → InputAction → 游戏函数
         (灵活映射层)        (语义化动作)
```

---

## 核心三件套

Enhanced Input System 由三个核心概念组成。缺一不可。

```
┌─────────────────────────────────────────────────────────────────┐
│                  Enhanced Input System 核心三件套                 │
├─────────────────┬─────────────────┬───────────────────────────────┤
│  InputAction    │ InputMapping    │ EnhancedInputComponent        │
│  (输入动作)      │ Context (映射   │ (增强输入组件)                 │
│                 │  上下文)        │                               │
├─────────────────┼─────────────────┼───────────────────────────────┤
│ "我要做什么"     │ "哪个按键触发它"  │ "谁来接收输入"                 │
│                 │                 │                               │
│ 例如: 跳跃、射击 │ 例如: 空格键→跳跃 │ 例如: 玩家角色                  │
│ 移动、交互       │ W键→向前移动     │                               │
│                 │ 手柄A键→跳跃     │                               │
├─────────────────┼─────────────────┼───────────────────────────────┤
│ 数据资产         │ 数据资产          │ C++类                        │
│ (uasset文件)    │ (uasset文件)     │ UEnhancedInputComponent     │
└─────────────────┴─────────────────┴───────────────────────────────┘
```

### 1. InputAction（输入动作）

```
┌──────────────────────────┐
│     InputAction          │
│                          │
│  "跳跃" 是一个动作        │
│  "开火" 是一个动作        │
│  "移动" 是一个动作        │
│                          │
│  动作与按键无关！          │
│  一个动作可以被多个按键触发  │
└──────────────────────────┘
```

- **是什么**：一个数据资产（`.uasset`文件），代表一个"游戏中的动作"。
- **关键属性**：`ValueType` —— 这个动作产生的值的类型。
  - `Bool`：开关型，如跳跃（按下/松开）
  - `Axis1D`：一维轴，如油门（0~1之间）
  - `Axis2D`：二维轴，如移动方向（X, Y）
  - `Axis3D`：三维轴，少数情况使用
- **与按键无关**：InputAction 不知道自己会被哪个按键触发。它只定义了"我要做什么"。

### 2. InputMappingContext（输入映射上下文）

```
┌──────────────────────────────────────┐
│     InputMappingContext              │
│                                      │
│  这是"绑定的容器"，把按键和动作连起来   │
│                                      │
│  ┌─────────────┐   ┌──────────────┐  │
│  │ 按键：空格键  │ → │ 动作：跳跃    │  │
│  │ 按键：W键    │ → │ 动作：向前移动 │  │
│  │ 按键：左键   │ → │ 动作：开火    │  │
│  │ 手柄：A键   │ → │ 动作：跳跃    │  │
│  └─────────────┘   └──────────────┘  │
│                                      │
│  可以叠加多个Context，有优先级          │
└──────────────────────────────────────┘
```

- **是什么**：一个数据资产，它把"物理按键"映射到"InputAction"。
- **核心作用**：你可以让同一个按键（如空格）映射到不同的 Context 中的不同动作。
- **可叠加**：可以同时激活多个 Context，优先级高的覆盖优先级低的。
- **场景举例**：
  - `IMC_Default` —— 默认移动、跳跃、开火（优先级0）
  - `IMC_Vehicle` —— 开车时的操作（优先级10，覆盖默认移动）
  - `IMC_UI` —— 菜单中的操作（优先级100，屏蔽游戏输入）

### 3. UEnhancedInputComponent（增强输入组件）

```
┌──────────────────────────────────────────┐
│     UEnhancedInputComponent              │
│                                          │
│  继承自 UInputComponent                   │
│  是连接 InputAction 和 C++ 函数的桥梁      │
│                                          │
│  BindAction(跳跃Action, 按下事件, &Xxx::OnJump)  │
│                     ↓                    │
│  当"跳跃Action"被触发时 → 调用 OnJump()   │
└──────────────────────────────────────────┘
```

- **是什么**：一个C++类，是 `UInputComponent` 的子类。
- **核心方法**：`BindAction()` —— 把一个 InputAction 绑定到一个 C++ 回调函数。
- **事件类型**：通过 `ETriggerEvent` 枚举区分"按下""松开""按住"等不同阶段。

---

## 数据流向全貌

下面是一套完整的输入数据流向，从物理按键按下到C++函数被调用：

```
玩家按下 W 键
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  操作系统                                                      │
│  检测到 "W 键被按下" 的硬件事件                                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  UE 引擎层                                                    │
│  将硬件事件转换为 UE 的 FKey 结构体                              │
│  FKey = "W"                                                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Enhanced Input System（增强输入系统）                          │
│                                                              │
│  ① 查找当前激活的 InputMappingContext                         │
│     "IMC_Default 是激活的吗？是。"                              │
│                                                              │
│  ② 在 Context 中查找匹配的键绑定                               │
│     "W 键 → 映射到了 IA_Move 动作"                             │
│                                                              │
│  ③ 应用修饰器（Modifier）对输入值进行加工                       │
│     "应用 DeadZone 修饰器，过滤掉小于 0.1 的微小输入"            │
│     "应用 SwizzleInputAxis 修饰器，交换 X/Y 轴"                │
│                                                              │
│  ④ 应用触发器（Trigger）判断是否应该触发这个动作                 │
│     "触发器类型是 Pressed，按键刚按下，触发！"                   │
│     （如果是 Hold，需要持续按下足够时间才触发）                    │
│                                                              │
│  ⑤ 计算最终的输入值                                            │
│     Bool类型 → true/false                                     │
│     Axis1D类型 → 0.0 ~ 1.0                                   │
│     Axis2D类型 → FVector2D(X, Y)                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  UEnhancedInputComponent                                     │
│                                                              │
│  ⑥ 触发 ETriggerEvent 事件                                    │
│     "IA_Move 的 Triggered 事件被触发"                          │
│                                                              │
│  ⑦ 查找通过 BindAction 绑定的回调函数                          │
│     "BindAction(IA_Move, ETriggerEvent::Triggered,           │
│                 this, &AMyCharacter::OnMove);"                │
│                                                              │
│  ⑧ 调用 C++ 回调函数                                          │
│     → OnMove(FInputActionValue) 被调用                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  C++ 回调函数                                                 │
│                                                              │
│  void AMyCharacter::OnMove(const FInputActionValue& Value)    │
│  {                                                           │
│      FVector2D MoveVector = Value.Get<FVector2D>();          │
│      AddMovementInput(GetActorForwardVector(),               │
│                       MoveVector.Y);                         │
│      AddMovementInput(GetActorRightVector(),                 │
│                       MoveVector.X);                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 架构图（文字描述）

```
                         ┌─────────────────────┐
                         │   操作系统/硬件驱动    │
                         │  键盘 鼠标 手柄 触摸屏  │
                         └──────────┬──────────┘
                                    │ 原始输入事件
                                    ▼
                         ┌─────────────────────┐
                         │   UE 输入子系统       │
                         │   将硬件事件转为FKey  │
                         └──────────┬──────────┘
                                    │ FKey
                                    ▼
         ┌──────────────────────────────────────────────────┐
         │           Enhanced Input 子系统                   │
         │                                                  │
         │  ┌────────────────────────────────────────────┐  │
         │  │  PlayerController                          │  │
         │  │  ┌──────────────────────────────────────┐ │  │
         │  │  │  EnhancedInputLocalPlayerSubsystem   │ │  │
         │  │  │                                      │ │  │
         │  │  │  持有所有已激活的 InputMappingContext  │ │  │
         │  │  │                                      │ │  │
         │  │  │  [IMC_Default 优先级0]              │ │  │
         │  │  │  [IMC_Vehicle 优先级10]             │ │  │
         │  │  │  [IMC_UI      优先级100]            │ │  │
         │  │  │                                      │ │  │
         │  │  │  对于每个按键事件:                      │ │  │
         │  │  │   1. 遍历Context（按优先级从高到低）     │ │  │
         │  │  │   2. 在Context中查找匹配的Key→Action   │ │  │
         │  │  │   3. 应用Modifier加工值                │ │  │
         │  │  │   4. 检测Trigger条件是否满足            │ │  │
         │  │  │   5. 如果满足 → 产生增强输入事件        │ │  │
         │  │  └──────────────────────────────────────┘ │  │
         │  └────────────────────────────────────────────┘  │
         │                                                  │
         └──────────────────────┬───────────────────────────┘
                                │ 增强输入事件
                                ▼
         ┌──────────────────────────────────────────────────┐
         │  UEnhancedInputComponent                        │
         │                                                  │
         │  维护绑定表:                                      │
         │  ┌──────────────────┬─────────────────────────┐ │
         │  │ InputAction      │ 回调函数                  │ │
         │  ├──────────────────┼─────────────────────────┤ │
         │  │ IA_Move          │ OnMove()                 │ │
         │  │ IA_Look          │ OnLook()                 │ │
         │  │ IA_Jump          │ OnJump()                 │ │
         │  │ IA_Fire          │ OnFire()                 │ │
         │  │ IA_Interact      │ OnInteract()             │ │
         │  └──────────────────┴─────────────────────────┘ │
         │                                                  │
         │  收到增强输入事件后:                               │
         │   1. 根据 InputAction 查找绑定表                  │
         │   2. 根据 ETriggerEvent 调用对应的回调             │
         │   3. 回调函数执行游戏逻辑                          │
         └──────────────────────┬───────────────────────────┘
                                │ 调用回调
                                ▼
         ┌──────────────────────────────────────────────────┐
         │  你的游戏代码                                      │
         │                                                  │
         │  void AMyCharacter::OnJump(const FInputActionValue& Val) │
         │  {                                               │
         │      Jump();                                     │
         │  }                                               │
         └──────────────────────────────────────────────────┘
```

---

## 旧输入系统 vs Enhanced Input 对比

### 概念对比

| 对比维度 | 旧输入系统 | Enhanced Input System |
|----------|-----------|----------------------|
| **动作定义** | 在代码中用字符串 `"Jump"` | InputAction 数据资产 |
| **按键绑定** | Project Settings → Input → ActionMappings | InputMappingContext 数据资产 |
| **绑定方式** | `PlayerInputComponent->BindAction("Jump", ...)` | `EnhancedInputComponent->BindAction(IA_Jump, ...)` |
| **按键类型** | Action（按下）和 Axis（连续值）分开 | 统一为 InputAction，用 ValueType 区分 |
| **C++类** | `UInputComponent` | `UEnhancedInputComponent`（子类） |
| **绑定函数** | `BindAction()` / `BindAxis()` | `BindAction()`（统一，靠 ValueType 和 TriggerEvent 区分） |

### 功能对比

| 功能 | 旧输入系统 | Enhanced Input System |
|------|-----------|----------------------|
| **运行时改键** | ❌ 需要自己实现 | ✅ 内置支持 `UEnhancedInputUserSettings` |
| **输入上下文切换** | ❌ 需要手动启用/禁用 | ✅ 自动优先级管理 |
| **组合键**（Ctrl+C） | ❌ 不支持 | ✅ 内置 Chord Action |
| **按住检测**（长按） | ❌ 需要自己计时 | ✅ 内置 Hold Trigger |
| **连击检测**（双击） | ❌ 需要自己实现 | ✅ 内置 Tap Trigger + Combo |
| **死区处理** | ❌ 手动代码 | ✅ DeadZone Modifier |
| **输入平滑** | ❌ 手动代码 | ✅ Smooth Modifier |
| **按键重映射** | ❌ 复杂的 INI 操作 | ✅ 简单的运行时 API |
| **手柄支持** | ⚠️ 基础支持，无高级功能 | ✅ 原生支持所有主流手柄 |
| **触摸屏支持** | ❌ 很差 | ✅ 原生支持 |
| **多个输入映射同一动作** | ⚠️ 需要多个绑定 | ✅ 在 Context 中轻松配置 |

### 代码对比

**旧输入系统的写法：**

```cpp
// === 旧输入系统 ===
// DefaultInput.ini 中的绑定:
// +ActionMappings=(ActionName="Jump",Key=SpaceBar,bShift=False,bCtrl=False,bAlt=False,bCmd=False)
// +AxisMappings=(AxisName="MoveForward",Key=W,Scale=1.0)
// +AxisMappings=(AxisName="MoveForward",Key=S,Scale=-1.0)

void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ❌ 旧方式：使用字符串绑定，容易拼写错误且没有编译检查
    PlayerInputComponent->BindAction("Jump", IE_Pressed, this, &AMyCharacter::OnJump);
    PlayerInputComponent->BindAxis("MoveForward", this, &AMyCharacter::OnMoveForward);
    PlayerInputComponent->BindAxis("MoveRight", this, &AMyCharacter::OnMoveRight);
    PlayerInputComponent->BindAction("Fire", IE_Pressed, this, &AMyCharacter::OnFire);
}

void AMyCharacter::OnMoveForward(float Value)
{
    // ❌ 回调函数签名不统一：有的传float，有的不传
    AddMovementInput(GetActorForwardVector(), Value);
}
```

**Enhanced Input System 的写法：**

```cpp
// === Enhanced Input System ===
// 不再使用 DefaultInput.ini，而是使用 InputMappingContext 资产
// 按键到动作的映射全部在编辑器的资产中配置

// C++ 代码中使用 UPROPERTY 引用数据资产
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ✅ 新方式：使用 UEnhancedInputComponent 绑定 InputAction 资产
    UEnhancedInputComponent* EnhancedInput = 
        CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // ✅ 使用资产指针，有编译检查，不会拼写错误
    EnhancedInput->BindAction(IA_Move, ETriggerEvent::Triggered, 
                              this, &AMyCharacter::OnMove);
    EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Started, 
                              this, &AMyCharacter::OnJump);
    EnhancedInput->BindAction(IA_Fire, ETriggerEvent::Started, 
                              this, &AMyCharacter::OnFire);
}

void AMyCharacter::OnMove(const FInputActionValue& Value)
{
    // ✅ 统一的函数签名：所有回调都接收 FInputActionValue
    FVector2D MoveVector = Value.Get<FVector2D>();
    AddMovementInput(GetActorForwardVector(), MoveVector.Y);
    AddMovementInput(GetActorRightVector(), MoveVector.X);
}
```

---

## 迁移建议

如果你正在从旧输入系统迁移到 Enhanced Input System，建议的迁移顺序：

1. **保持旧代码不动**，先让 Enhanced Input 跑起来
2. **创建 InputAction 资产**，对应现有的输入动作
3. **创建 InputMappingContext 资产**，配置键位绑定
4. **逐功能迁移**：先迁移移动，再迁移跳跃，再迁移其他
5. **测试手柄**：Enhanced Input 的手柄支持更好，这时你可以改手柄配置
6. **移除旧代码**：确认所有功能正常后，删除旧的绑定代码和 INI 配置
7. **利用新功能**：添加长按、双击、组合键等旧系统不支持的功能

---

## ✅ 完成检查清单

读完本节后，你应该能回答以下问题：

- [ ] Enhanced Input System 解决了旧输入系统的哪6个主要问题？
- [ ] 核心三件套：InputAction、InputMappingContext、UEnhancedInputComponent 分别负责什么？
- [ ] 能从键盘按下到C++函数执行，完整描述数据流向（8个步骤）吗？
- [ ] ValueType 有哪4种，分别用在什么场景？
- [ ] InputMappingContext 的优先级机制有什么作用？举一个场景例子。
- [ ] 旧输入系统和 Enhanced Input System 在"动作定义""按键绑定""C++绑定"上有哪些根本区别？
- [ ] FInputActionValue 相比旧系统的回调参数有什么优势？

---

> **下一步**：[7.2 InputAction 与 InputMappingContext](./02-InputAction与InputMappingContext.md) —— 深入了解两个核心数据资产。