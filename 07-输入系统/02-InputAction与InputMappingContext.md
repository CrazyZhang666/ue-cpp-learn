# 7.2 InputAction 与 InputMappingContext

> **目标**：深入理解InputAction和InputMappingContext这两个核心数据资产，学会在编辑器中创建和配置它们。

---

## 一、InputAction（输入动作）详解

### 1.1 InputAction 的本质

一个 InputAction 资产（`.uasset`文件）只描述**一个动作的"性质"**，不涉及任何按键。它就像是一个接口契约：

```
InputAction = 动作名称 + 值类型 + 触发条件配置

"站在InputAction的角度看世界："
  我不在乎是谁触发了我（空格键？手柄A键？触摸屏？）
  我只在乎：
    - 我是谁？（IA_Jump）
    - 我产生的值是什么类型？（bool：按了/没按）
    - 什么时候算我被触发了？（一按下就触发？还是按住0.5秒？）
```

### 1.2 在编辑器中创建 InputAction

**操作步骤**：

```
步骤1: 打开内容浏览器（Content Browser）
步骤2: 右键 → Miscellaneous → Input Action
        （或者点击左上角 Add → Miscellaneous → Input Action）
步骤3: 命名为 IA_<动作名>，例如 IA_Jump, IA_Move, IA_Look
        命名规范：以 IA_ 开头，使用大驼峰命名
步骤4: 双击打开，进入配置界面
```

> **命名规范**：遵循UE的命名约定。
>
> - ✅ `IA_Jump`, `IA_Move`, `IA_Fire`, `IA_Crouch`
> - ✅ `IA_LightAttack`, `IA_HeavyAttack`
> - ❌ `JumpAction`, `MoveInput`, `fire`（不统一、不规范）
>
> 统一使用 `IA_` 前缀，可以一眼识别这是一个 InputAction 资产。

### 1.3 ValueType —— 值的类型

这是 InputAction 最重要的属性，决定了这个动作产生的"数据形状"。

```
┌──────────────────────────────────────────────────────────┐
│  ValueType 的4种选择                                       │
├─────────────┬────────────────┬───────────────────────────┤
│  Bool       │ true / false   │ 跳跃、冲刺、使用物品         │
│             │                │ 开关型动作                  │
├─────────────┼────────────────┼───────────────────────────┤
│  Axis1D     │ 浮点数 (float) │ 油门、缩放滚轮、刹车         │
│  (数字型)   │ 0.0 ~ 1.0      │ 一维连续值                 │
├─────────────┼────────────────┼───────────────────────────┤
│  Axis2D     │ FVector2D      │ 移动方向、鼠标视角           │
│  (二维向量) │ (X, Y)         │ 手柄摇杆                    │
├─────────────┼────────────────┼───────────────────────────┤
│  Axis3D     │ FVector        │ 飞行模拟的油门/俯仰/横滚     │
│  (三维向量) │ (X, Y, Z)      │ 特殊输入场景                │
└─────────────┴────────────────┴───────────────────────────┘
```

**选择指南**：

```cpp
// 选择 Bool 的场景：
// "跳跃"只有两种状态：正在按/没按
IA_Jump   → ValueType = Bool

// 选择 Axis1D 的场景：
// "油门"是连续值，从0（不踩）到1（踩到底）
IA_Throttle → ValueType = Axis1D

// 选择 Axis2D 的场景：
// "移动"需要两个维度的值：前后(Y) 和 左右(X)
IA_Move → ValueType = Axis2D

// "鼠标视角"也需要两个维度：上下(鼠标Y) 和 左右(鼠标X)
IA_Look → ValueType = Axis2D
```

### 1.4 Triggers 和 Modifiers 的概念

在 InputAction 的编辑界面中，底部有两个重要的折叠区域：

```yaml
InputAction 编辑界面:
  ├── ValueType: [下拉选择]
  ├── Triggers (触发器数组):
  │   ├── [0] Pressed      ← 按下即触发
  │   ├── [1] Released     ← 松开时触发
  │   └── [2] Hold         ← 按住一定时间后触发
  └── Modifiers (修饰器数组):
      ├── [0] DeadZone     ← 过滤掉微小的输入
      ├── [1] Negate       ← 反转值（正变负）
      └── [2] Scalar       ← 缩放值（乘以一个系数）
```

**关键理解**：

- **Triggers（触发器）**决定"**什么时候**"通知C++代码。
- **Modifiers（修饰器）**决定通知C++代码"**什么值**"。

```
原始输入 → [Modifier1] → [Modifier2] → [Modifier3] → 加工后的值 → [Trigger判断] → 符合条件 → 通知C++
                  │                                            │
                  │ "把值加工一下"                              │ "时间对吗？"
                  │                                            │
```

---

## 二、触发器（Trigger）详解

触发器在 InputAction 上配置（也可以在 InputMappingContext 的绑定条目上覆盖配置）。

### 2.1 内置触发器一览

| 触发器               | 作用                             | 典型用途               |
| -------------------- | -------------------------------- | ---------------------- |
| **Pressed**          | 按键按下的瞬间触发一次           | 跳跃、开枪（单发）     |
| **Released**         | 按键松开的瞬间触发一次           | 停止蓄力、松开瞄准     |
| **Down**             | 按键被按住时每帧都触发           | 持续移动、连射         |
| **Hold**             | 按键按住超过指定时间后触发       | 长按交互、长按拾取     |
| **Hold And Release** | 按住超时，或超时后松开发布时触发 | 蓄力攻击               |
| **Tap**              | 快速点击（按下后很快松开）       | 轻攻击                 |
| **Pulse**            | 按住后周期性触发                 | 按住连射、按住滚动列表 |

### 2.2 Pressed 触发器

```
特性：
  - 按下瞬间触发一次
  - 不会在持续按下时重复触发
  - 适合"一次性"的动作

时间线示例（按空格键）：

  按键: ▁▁▁▁▁████████████████▁▁▁▁▁▁
  Pressed:        ●
  Released:                       ●

  ● 标记处触发事件
```

**配置参数**：

- `ActuationThreshold`：按下阈值（默认0.5，对有行程的扳机键有效）
- 一般不需要修改，保持默认即可

### 2.3 Down 触发器

```
特性：
  - 按住期间每一帧都触发
  - 适合"持续进行"的动作

时间线示例（每帧是一个╎）：

  按键: ▁▁▁▁▁████████████████▁▁▁▁▁▁
  Down:          ╎╎╎╎╎╎╎╎╎╎╎╎╎╎╎

  ╎ 每一帧都触发
```

> **注意**：Down 通常不在 InputAction 上配置，而是和 BindAction 的 `ETriggerEvent::Triggered` 配合使用。我们来理解一下两者的关系：
>
> - InputAction 的 Trigger 在"数据层面"决定什么条件下产生事件
> - BindAction 的 ETriggerEvent 在"代码层面"决定你要响应哪种事件
> - **两者是正交的**：一个控制数据何时产生，一个控制代码何时接收

### 2.4 Hold 触发器

```
特性：
  - 按住超过"HoldTimeThreshold"后触发一次
  - 可以用来区分"短按"和"长按"

配置参数：
  - HoldTimeThreshold: 需要按住多长时间才算"长按"（秒）
  - 例如设置为 0.5，则按住超过0.5秒时触发

时间线示例（HoldTimeThreshold = 0.5秒）：

  按键: ▁▁▁▁▁███████████████████████▁▁▁
  时间:      0    0.25    0.5    0.75   1.0
  Pressed:        ●
  Hold:                       ●  ← 按住超过0.5秒时触发

典型用途：
  - 长按R键 → 卸下所有弹匣
  - 短按R键 → 换弹
  - 长按E键 → 拾取全部物品
```

**长按 vs 短按的实现方案**：

```cpp
// 方案A：使用两个 InputAction + Hold Trigger
// IA_Interact_Tap → Trigger = Pressed → OnInteract()
// IA_Interact_Hold → Trigger = Hold(0.5s) → OnInteractHold()

// 方案B：使用一个 InputAction，在代码中区分
// 在 Started 时记录时间，在 Completed 时计算差值判断
// （方案A更简洁，推荐使用方案A）
```

### 2.5 Tap 触发器

```
特性：
  - 按下后在"TapReleaseTimeThreshold"时间内松开则触发
  - 用来检测"快速点击"
  - 如果按下时间太长超过阈值，则不会触发

配置参数：
  - TapReleaseTimeThreshold: 最大释放时间（秒）
    例如设置为 0.2，则按下后0.2秒内松开才算"Tap"

时间线示例（TapReleaseTimeThreshold = 0.2秒）：

  快速点击（触发Tap）:
  按键: ▁▁██▁▁▁▁▁▁▁▁▁▁
  时间:    0  0.2
  Tap:            ●  ← 0.12秒就松开了，符合Tap条件

  长按（不触发Tap）:
  按键: ▁▁███████████▁▁▁
  时间:    0  0.2   0.5
  Tap:  ❌ 不触发 ← 超过了0.2秒才松开
```

### 2.6 Pulse 触发器

```
特性：
  - 按住后每隔一段时间触发一次
  - 类似"连射"的效果

配置参数：
  - Interval: 触发间隔（秒），例如0.1 = 每秒10次
  - TriggerOnStart: 是否第一个脉冲立即触发（默认true）

时间线示例（Interval = 0.15秒, TriggerOnStart = true）：

  按键: ▁▁███▁▁▁▁▁▁▁▁▁▁▁▁
  Pulse:     ●   ●   ●   ●
 间隔:     0  0.15 0.30 0.45

典型用途：
  - 按住左键连续射击（比Down更节制的触发频率）
  - 滚动列表时的自动滚动
```

---

## 三、修饰器（Modifier）详解

修饰器在输入值传递给 Trigger 判断之前对其进行"加工"。

### 3.1 修饰器的处理流程

```
原始输入值 ──→ [Modifier 0] ──→ [Modifier 1] ──→ [Modifier 2] ──→ 最终值
                                                  │
                                  修饰器按顺序依次加工输入值
                                  每个修饰器的输出是下一个的输入
```

### 3.2 常用修饰器

| 修饰器                        | 作用                         | 参数            | 典型用途              |
| ----------------------------- | ---------------------------- | --------------- | --------------------- |
| **Dead Zone**                 | 过滤低于阈值的微小输入       | LowerThreshold  | 摇杆漂移修正          |
| **Negate**                    | 反转输入值（正变负，负变正） | 可分别反转X/Y/Z | 反转Y轴，反转鼠标方向 |
| **Scalar**                    | 乘以一个缩放系数             | Scalar值        | 调整鼠标灵敏度        |
| **Smooth**                    | 平滑输入值，减少突变         | SampleCount     | 摇杆平滑过渡          |
| **Swizzle Input Axis Values** | 交换/重排各轴的值            | 顺序配置        | WASD和摇杆统一        |
| **Response Curve**            | 使用曲线图来调整输入响应     | 曲线资产        | 自定义摇杆响应曲线    |

### 3.3 Dead Zone 修饰器（死区）

```
问题：手柄摇杆在静止时可能产生微小的漂移值
      0.002, -0.001, 0.003 ... 这些微小值会导致角色微微移动

解决方案：Dead Zone 修饰器
      设置 LowerThreshold = 0.1

      输入 0.002 → 0.0（被过滤）
      输入 0.08  → 0.0（被过滤，低于0.1）
      输入 0.15  → 0.15（保留，高于阈值）
      输入 0.50  → 0.50（保留）

配置参数：
  - LowerThreshold (下限): 低于此值的输入被归零
  - UpperThreshold (上限): 高于此值的输入被钳制为1.0
  - Type: 死区类型
    - Radial: 以原点为圆心的圆形死区（适合摇杆）
    - Axial: 每个轴独立的死区
```

**配置示例**：

```
手柄左摇杆（移动）的推荐 Dead Zone:
  LowerThreshold = 0.15  ← 摇杆轻微偏移不会触发移动
  Type = Radial

手柄右摇杆（视角）的推荐 Dead Zone:
  LowerThreshold = 0.10  ← 视角控制通常需要更灵敏
  Type = Radial
```

### 3.4 Negate 修饰器（取反）

```
作用：反转输入值的符号

配置参数：
  - bX, bY, bZ: 是否反转对应轴

场景1：反转鼠标Y轴（某些玩家习惯"上推视角向下看"）
  - IA_Look 上添加 Negate，勾选 bY = true
  - 鼠标上移 → 原本 Y=+1.0 → Negate后 Y=-1.0 → 视角向下

场景2：S键处理（不推荐使用Negate，更好的方式是Swizzle + Negate组合
         或者直接在Context中把S键的Scale设为-1）
```

### 3.5 Scalar 修饰器（缩放）

```
作用：将输入值乘以一个常数

配置参数：
  - Scalar: 缩放系数

场景1：鼠标灵敏度调整
  - IA_Look 上添加 Scalar，设置值为 0.5
  - 鼠标移动 → 原本输出值100% → 缩放后输出50% → 视角转动速度减半

场景2：摇杆加速
  - IA_Move 上添加 Scalar，设置值为 2.0
  - 摇杆推到底 → 原本输出1.0 → 缩放后输出2.0 → 角色跑得更快
```

### 3.6 Smooth 修饰器（平滑）

```
作用：对输入值进行平滑处理，减缓突变

原理：取最近N帧的输入值，计算移动平均或加权平均

配置参数：
  - SampleCount: 采样帧数，越大越平滑但延迟也越高
    - 2-5: 轻微平滑，响应快
    - 6-10: 明显平滑，适合摇杆
    - 11+: 非常平滑但延迟明显

场景：手柄摇杆输入平滑
  - IA_Move 上添加 Smooth，SampleCount = 5
  - 摇杆从0推到1，输出值不会立刻变1，而是用5帧过渡到1
```

### 3.7 Swizzle Input Axis Values（轴交换）

```
作用：交换/重排输入轴的顺序

配置参数：
  - Order: 轴的顺序，默认是 YXZ（UE使用YXZ顺序的手柄输入）

为什么默认是 YXZ？
  手柄输入: X = 左右, Y = 前后
  UE坐标:  X = 左右, Y = 前后
  但键盘输入: W/S = 前后 → 映射到 Y
             A/D = 左右 → 映射到 X

  Swizzle 让我们统一手柄和键盘的轴顺序

场景：将 YXZ → XYZ（交换X和Y轴）
  - 当你在 Context 中将键盘按键绑定到 Axis2D 的特定轴时可以用到
```

### 3.8 Response Curve 修饰器（响应曲线）

```
作用：使用自定义曲线调整输入响应

原理：输入值作为曲线的X（横轴），曲线的Y（纵轴）作为输出值

场景：自定义摇杆的非线性响应
  - 前半段（0~0.5）：曲线平缓，微调视角时很慢
  - 后半段（0.5~1.0）：曲线陡峭，推到底时转动很快

  这样既能精确瞄准（微推摇杆），又能快速转身（推到底）

  输出值 ↑
     1.0 │                    ╱
         │                  ╱
     0.6 │                ╱
         │             ╱
     0.2 │         ╱╱
         │     ╱╱
     0.0 │╱╱╱──────────────→ 输入值
         0    0.25   0.5    0.75    1.0
```

---

## 四、InputMappingContext（输入映射上下文）

### 4.1 IMC 的本质

```
InputMappingContext = 一组 "按键 → 动作" 的绑定集合

它是一个"场景配置"：
  - 玩家操控角色时 → 激活 IMC_Default
  - 玩家开车时     → 激活 IMC_Vehicle
  - 玩家打开菜单时  → 激活 IMC_UI
```

### 4.2 在编辑器中创建 InputMappingContext

**操作步骤**：

```
步骤1: 在内容浏览器中
       右键 → Miscellaneous → Input Mapping Context
步骤2: 命名为 IMC_<场景名>，例如：
       IMC_Default
       IMC_Vehicle
       IMC_UI
       命名规范：以 IMC_ 开头
步骤3: 双击打开编辑界面
```

### 4.3 IMC 编辑界面

```
┌────────────────────────────────────────────────────────┐
│  Input Mapping Context: IMC_Default                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Mappings (映射列表):                                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [+ Add Mapping]                                  │ │
│  │                                                  │ │
│  │ ▼ [0] IA_Move                                    │ │
│  │    W (Scale: 1.0)    →  给 Axis2D 的 Y 轴        │ │
│  │    S (Scale: -1.0)   →  给 Axis2D 的 Y 轴        │ │
│  │    A (Scale: -1.0)   →  给 Axis2D 的 X 轴        │ │
│  │    D (Scale: 1.0)    →  给 Axis2D 的 X 轴        │ │
│  │    Gamepad Left Thumbstick 2D                     │ │
│  │    [Triggers] [Modifiers]  ← 此条目的专属触发器/修饰器│ │
│  │                                                  │ │
│  │ ▼ [1] IA_Look                                    │ │
│  │    Mouse XY 2D (Scale: 1.0)                      │ │
│  │    Gamepad Right Thumbstick 2D                    │ │
│  │    [Triggers] [Modifiers]                        │ │
│  │                                                  │ │
│  │ ▼ [2] IA_Jump                                    │ │
│  │    Space Bar                                      │ │
│  │    Gamepad Face Button Bottom (A键)               │ │
│  │    [Triggers] [Modifiers]                        │ │
│  │                                                  │ │
│  │ ▼ [3] IA_Crouch                                  │ │
│  │    Left Control                                   │ │
│  │    Gamepad Left Thumbstick Button                 │ │
│  │    [Triggers] [Modifiers]                        │ │
│  │                                                  │ │
│  │ ...更多映射...                                    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  Context Priority: [0]  ← 优先级设置                      │
└────────────────────────────────────────────────────────┘
```

### 4.4 添加一个映射条目的详细步骤

以添加"移动"为例：

```
步骤1: 点击 Mappings 旁边的 [+ Add Mapping] 按钮
步骤2: 点击 Input Action 下拉框，选择 IA_Move
步骤3: 点击按键输入框，按下 W 键
       → 显示为 "W" 或 "W (Keyboard)"
步骤4: 设置 Scale（缩放值）
       W键 → Scale = 1.0 （向前，正值）
步骤5: 再添加一个按键（同一个映射条目可以绑定多个按键）
       点击 [+] 添加 S 键
       S键 → Scale = -1.0 （向后，负值）
步骤6: 继续添加 A 和 D
       A键 → Scale = -1.0 （向左，负值）
       D键 → Scale = 1.0 （向右，正值）
步骤7: 给手柄也绑定
       再点击 [+]，选择 Gamepad Left Thumbstick 2D
       （摇杆自动提供二维值，不需要分别设置X和Y的Scale）
```

### 4.5 一个条目的 Triggers 和 Modifiers

除了在 InputAction 上设置 Triggers/Modifiers 外，**IMC 中的每个绑定条目也可以单独覆盖设置**：

```
优先级（从高到低）：
  条目的 Triggers/Modifiers（IMC中设置）
       ↓ 覆盖
  InputAction 上的 Triggers/Modifiers（IA资产中设置）

这意味着：
  - IA_Move 的全局 DeadZone 是 0.1
  - 但在 IMC_Vehicle 中，IA_Move 条目的 DeadZone 可以设为 0.05
  - IMC_Vehicle 的设置覆盖 IA_Move 的全局设置
```

**常用场景**：

```
当你需要相同的 InputAction 在不同 Context 中有不同行为时：
  IA_Look 鼠标灵敏度：
    在 IMC_Default 中 → Scalar = 1.0（正常灵敏度）
    在 IMC_Sniper 中 → Scalar = 0.3（开镜时降低灵敏度）
```

---

## 五、优先级和冲突解决

### 5.1 多个 Context 同时激活

你可以同时激活多个 InputMappingContext，它们会按优先级决定"谁说了算"：

```
┌─────────────────────────────────────────────┐
│  同时激活的 Context                          │
│                                             │
│  [最高优先级] IMC_UI       优先级 = 100      │
│       ↑                                     │
│       │  优先级高的"赢得"竞争                  │
│       │                                     │
│  [中等优先级] IMC_Vehicle  优先级 = 50       │
│       ↑                                     │
│       │                                     │
│  [最低优先级] IMC_Default  优先级 = 0        │
└─────────────────────────────────────────────┘
```

### 5.2 冲突解决规则

当多个 Context 中都有同一个按键的绑定时：

```
规则1: 优先级高的 Context 中的绑定优先处理
规则2: 如果高优先级的 Context 处理了这个按键，低优先级的 Context
       就不会再收到这个按键的事件了（默认行为）

示例:
  IMC_UI (优先级100):
    E键 → IA_UIConfirm  ← E键被绑定到"确认"

  IMC_Default (优先级0):
    E键 → IA_Interact   ← E键也被绑定到"交互"

  结果: 当UI打开时，按E键触发"确认"而非"交互"
        （因为IMC_UI优先级更高，它"拦截"了E键事件）
```

### 5.3 Context 激活和停用的代码

```cpp
#include "EnhancedInputSubsystems.h"

// 获取 EnhancedInputLocalPlayerSubsystem
UEnhancedInputLocalPlayerSubsystem* Subsystem =
    ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
        GetLocalPlayer());

if (Subsystem)
{
    // 添加（激活）一个 Context
    // 参数1: 要激活的 Context 资产
    // 参数2: 优先级（数值越大优先级越高）
    Subsystem->AddMappingContext(IMC_Default, 0);
    Subsystem->AddMappingContext(IMC_Vehicle, 10);

    // 移除（停用）一个 Context
    Subsystem->RemoveMappingContext(IMC_Default);

    // 清空所有 Context
    Subsystem->ClearAllMappings();
}
```

### 5.4 典型场景：游戏模式 vs 菜单模式

```
场景实现思路：

游戏开始:
  AddMappingContext(IMC_Default, 0)
  → 角色可以移动、跳跃、开火

玩家按ESC打开菜单:
  AddMappingContext(IMC_UI, 100)  ← 高优先级，拦截所有按键
  → 此时WASD控制菜单光标，空格确认
  → IMC_Default 的移动/跳跃被屏蔽

玩家关闭菜单:
  RemoveMappingContext(IMC_UI)
  → 恢复 IMC_Default 的所有功能
  → WASD重新控制角色移动
```

---

## 六、编辑器实操：完整配置一条输入链

让我们从头到尾配置"角色跳跃"的完整输入链：

### 步骤1：创建 InputAction 资产

```
1. 打开 Content Browser
2. 导航到 Content/Input/Actions/ 目录（没有就新建）
3. 右键 → Miscellaneous → Input Action
4. 命名为 IA_Jump
5. 双击打开 IA_Jump
6. 设置 ValueType = Bool（跳跃只有跳/不跳两种状态）
7. 在 Triggers 区域添加一个 Pressed 触发器
   （按下时触发，不需要 Released）
8. 保存（Ctrl+S）
```

### 步骤2：创建 InputMappingContext 资产

```
1. 导航到 Content/Input/ 目录
2. 右键 → Miscellaneous → Input Mapping Context
3. 命名为 IMC_Default
4. 双击打开 IMC_Default
5. 点击 Mappings 旁边的 [+ Add Mapping]
6. 在 Input Action 下拉框中选择 IA_Jump
7. 在按键输入框中按下"空格键"
   → 显示为 "Space Bar"
8. 点击按键条目旁边的 [+] 添加手柄按键
9. 选择 "Gamepad Face Button Bottom"（对应Xbox的A键 / PS的×键）
10. 保存（Ctrl+S）
```

### 步骤3：在C++中引用资产

```cpp
// MyCharacter.h
#pragma once

#include "CoreMinimal.h"
#include "InputActionValue.h"  // FInputActionValue 需要此头文件
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"

class UInputAction;           // 前向声明
class UInputMappingContext;   // 前向声明

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // InputAction 资产引用（将在蓝图中赋值）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    UInputAction* IA_Jump;

    // InputMappingContext 资产引用
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    UInputMappingContext* IMC_Default;

protected:
    // 跳跃回调
    void OnJump(const FInputActionValue& Value);
};
```

### 步骤4：在蓝图中赋值资产引用

```
方法1：在角色蓝图中赋值
  1. 创建 AMyCharacter 的蓝图子类 BP_MyCharacter
  2. 打开蓝图，在 Details 面板找到 Input 分类
  3. 将 IA_Jump 资产拖入 IA_Jump 变量槽
  4. 将 IMC_Default 资产拖入 IMC_Default 变量槽
  5. 编译并保存蓝图

方法2：在C++构造函数中使用 ConstructorHelpers（不推荐，耦合太紧）
  // ❌ 不推荐：路径硬编码，资产移动后代码就坏了
  static ConstructorHelpers::FObjectFinder<UInputAction> JumpAction(
      TEXT("/Game/Input/Actions/IA_Jump"));
  IA_Jump = JumpAction.Object;

  // ✅ 推荐：用 UPROPERTY 暴露变量，在蓝图中手动赋值
  // 这样资产路径变了只需要在蓝图中重新指一下即可
```

---

## ✅ 完成检查清单

- [ ] 能独立创建一个 InputAction 资产，并选择正确的 ValueType 吗？
- [ ] 能独立创建一个 InputMappingContext 资产，并添加按键绑定吗？
- [ ] 能解释 ValueType 的4种类型（Bool/Axis1D/Axis2D/Axis3D）各自适用场景吗？
- [ ] 能说出 Pressed、Released、Down、Hold、Tap、Pulse 6种触发器的区别吗？
- [ ] 理解 DeadZone 是做什么的？为什么手柄需要它？
- [ ] 理解 Negate 和 Scalar 修饰器的用途？
- [ ] 理解 IMC 的优先级机制？能举例说明游戏模式和菜单模式的切换思路吗？
- [ ] 理解 Context 条目上的 Triggers/Modifiers 会覆盖 InputAction 上的设置吗？
- [ ] 知道在C++中如何用 UPROPERTY 引用 IA 和 IMC 资产吗？

---

> **下一步**：[7.3 C++ 绑定输入](./03-CPP绑定输入.md) —— 在C++代码中使用 Enhanced Input System。
