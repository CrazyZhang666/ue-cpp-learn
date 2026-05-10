# 7.3 C++ 绑定输入

> **目标**：学会在C++代码中配置 Enhanced Input System 的模块依赖，使用 BindAction 绑定输入，并处理各种类型的输入回调。

---

## 一、在 Build.cs 中添加模块依赖

Enhanced Input System 是一个独立模块，需要显式添加到项目的构建依赖中。

### 1.1 添加依赖

打开项目的 `[ProjectName].Build.cs` 文件（位于 `Source/[ProjectName]/` 目录）：

```cpp
// MyGame.Build.cs
// 此文件定义了项目的编译规则和模块依赖

using UnrealBuildTool;

public class MyGame : ModuleRules
{
    public MyGame(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        // ===== 公共依赖（PublicDependencyModuleNames）=====
        // 这些模块会在你的头文件中使用时自动传递给依赖你的其他模块
        // 如果你的 .h 文件中 #include 了某模块的头文件，就加到 Public 中
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",           // UE核心：FString, TArray, FMath等
            "CoreUObject",    // UObject系统：反射、GC、序列化
            "Engine",         // 引擎基础：AActor, APawn, ACharacter等
            "InputCore",      // 输入核心：FKey, 键盘/鼠标/手柄键值定义
        });

        // ===== 私有依赖（PrivateDependencyModuleNames）=====
        // 这些模块只在 .cpp 文件中使用，不会暴露给外部
        // 如果你的 .h 中不需要引用这些模块，就加到 Private 中
        PrivateDependencyModuleNames.AddRange(new string[]
        {
            // ⚠️ 这一行是关键！不加这个会编译报错：
            // "fatal error C1083: 无法打开包括文件: EnhancedInputComponent.h"
            "EnhancedInput",  // Enhanced Input System
        });

        // 说明：
        // ✅ "EnhancedInput" 包含了：
        //    - UEnhancedInputComponent（绑定用的组件）
        //    - UEnhancedInputLocalPlayerSubsystem（激活/停用Context）
        //    - UInputAction / UInputMappingContext（数据资产类）
        //    - FInputActionValue（输入值的包装类）
        //    - ETriggerEvent（触发事件枚举）
    }
}
```

### 1.2 你要引入的头文件

在你的游戏代码中，根据需要使用以下 `#include`：

```cpp
// ===== 必加的头文件 =====

// UEnhancedInputComponent —— 绑定输入的核心类
#include "EnhancedInputComponent.h"

// UEnhancedInputLocalPlayerSubsystem —— 激活/停用 IMC
#include "EnhancedInputSubsystems.h"

// FInputActionValue —— 输入值的包装
#include "InputActionValue.h"


// ===== 可选的头文件（通常只需要前向声明，.h中不需要include）=====

// UInputAction —— 通常只需要前向声明 class UInputAction;
// UInputMappingContext —— 通常只需要前向声明 class UInputMappingContext;
// ETriggerEvent —— 在 EnhancedInputComponent.h 中已经包含
```

> **经验法则**：
> - `.h` 文件中：尽量使用前向声明 `class UInputAction;`，避免头文件膨胀
> - `.cpp` 文件中：才 `#include "EnhancedInputComponent.h"` 等实际头文件

---

## 二、声明 UPROPERTY 引用

### 2.1 在 Character 类中声明

```cpp
// MyCharacter.h
#pragma once

#include "CoreMinimal.h"
#include "InputActionValue.h"     // FInputActionValue 需要这个头文件
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"

// ⚠️ 前向声明：.h 中不需要 include 完整头文件
class UInputAction;           // 输入动作资产
class UInputMappingContext;   // 输入映射上下文资产

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ===== 构造函数 =====
    AMyCharacter();

protected:
    // ===== 输入映射上下文（IMC）=====
    // EditAnywhere: 可以在蓝图Details面板中编辑
    // BlueprintReadOnly: 蓝图可以读取（Get节点），但不能写入
    // Category = "Input": 在Details面板中归到"Input"分类下
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputMappingContext> IMC_Default;
    // TObjectPtr 是UE5.1+推荐的UObject指针类型，比裸指针更安全

    // ===== 输入动作（IA）引用 =====
    // 每个动作一个变量，在蓝图中手动赋值对应的资产

    // 移动（2D轴：前后+左右）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Move;

    // 视角（2D轴：上下+左右）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Look;

    // 跳跃（Bool：按下/松开）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Jump;

    // 冲刺（Bool：按住不放）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Sprint;

    // 蹲伏（Bool：切换）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Crouch;

    // 攻击（Bool：按下触发）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Attack;

    // 交互（Bool：按下触发）
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Interact;

protected:
    // ===== 输入回调函数声明 =====

    /** 移动输入回调 */
    void OnMove(const FInputActionValue& Value);

    /** 视角输入回调 */
    void OnLook(const FInputActionValue& Value);

    /** 跳跃输入回调（按下时触发）*/
    void OnJumpStarted(const FInputActionValue& Value);

    /** 跳跃输入回调（松开时触发）*/
    void OnJumpCompleted(const FInputActionValue& Value);

    /** 冲刺开始（按下时）*/
    void OnSprintStarted(const FInputActionValue& Value);

    /** 冲刺结束（松开时）*/
    void OnSprintCompleted(const FInputActionValue& Value);

    /** 蹲伏切换（按下时触发）*/
    void OnCrouchToggle(const FInputActionValue& Value);

    /** 攻击 */
    void OnAttackStarted(const FInputActionValue& Value);

    /** 交互（E键）*/
    void OnInteractStarted(const FInputActionValue& Value);

protected:
    // ===== 重写 SetupPlayerInputComponent =====
    // 这个函数在 Pawn 被 PlayerController 控制时自动调用
    // 是绑定输入的标准位置
    virtual void SetupPlayerInputComponent(
        class UInputComponent* PlayerInputComponent) override;

private:
    // 冲刺状态标记
    bool bIsSprinting = false;
};
```

### 2.2 资产引用变量的赋值

```
重要提示：
  上面的 UPROPERTY 变量在 C++ 中声明后，它们的值需要在蓝图中手动赋值。

流程：
  1. 编译 C++ 代码
  2. 在编辑器中创建 AMyCharacter 的蓝图子类（右键 → Create Blueprint Class）
  3. 打开蓝图，在 Class Defaults 或 Details 面板中找到 "Input" 分类
  4. 你会看到 IA_Move, IA_Look, IA_Jump ... 这些变量
  5. 从 Content Browser 中将对应的资产拖入这些槽中
  6. 编译并保存蓝图

不赋值会发生什么？
  ❌ 如果 IA_Jump 为空（nullptr），BindAction 会静默失败
  ❌ 按下空格键不会有任何反应，但也不会崩溃
  ✅ 可以在 BindAction 前用 ensure(IA_Jump) 校验，在编辑器中弹出警告
```

---

## 三、SetupPlayerInputComponent 中的绑定

### 3.1 标准绑定模式

```cpp
// MyCharacter.cpp
#include "MyCharacter.h"
#include "EnhancedInputComponent.h"       // UEnhancedInputComponent
#include "EnhancedInputSubsystems.h"      // UEnhancedInputLocalPlayerSubsystem
#include "InputActionValue.h"             // FInputActionValue
#include "GameFramework/PlayerController.h"

void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ===== 第1步：类型转换 =====
    // UInputComponent 是基类，Enhanced Input 需要它的子类
    // CastChecked 在类型不匹配时会触发断言崩溃（开发时尽早暴露问题）
    UEnhancedInputComponent* EnhancedInput =
        CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // 如果担心崩溃，也可以用普通 Cast + 检查:
    // UEnhancedInputComponent* EnhancedInput =
    //     Cast<UEnhancedInputComponent>(PlayerInputComponent);
    // if (!EnhancedInput) { return; }

    // ===== 第2步：绑定 InputAction 到回调函数 =====
    // BindAction 的完整签名:
    // void BindAction(
    //     const UInputAction* Action,           // 要绑定的动作资产
    //     ETriggerEvent TriggerEvent,           // 触发事件类型
    //     UObject* Object,                      // 回调函数所属对象（通常是this）
    //     FName FunctionName                    // 回调函数的名字（反射绑定）
    // );
    //
    // 或使用模板版本（类型安全，推荐）:
    // template<class UserClass, typename... Args>
    // void BindAction(
    //     const UInputAction* Action,
    //     ETriggerEvent TriggerEvent,
    //     UserClass* Object,
    //     void(UserClass::*Func)(Args...)
    // );

    // 移动：按住时每帧触发
    if (IA_Move)
    {
        EnhancedInput->BindAction(IA_Move, ETriggerEvent::Triggered,
                                  this, &AMyCharacter::OnMove);
    }

    // 视角：每帧触发（鼠标持续移动）
    if (IA_Look)
    {
        EnhancedInput->BindAction(IA_Look, ETriggerEvent::Triggered,
                                  this, &AMyCharacter::OnLook);
    }

    // 跳跃：按下时触发
    if (IA_Jump)
    {
        EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnJumpStarted);
    }

    // 跳跃：松开时触发（可选）
    if (IA_Jump)
    {
        EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Completed,
                                  this, &AMyCharacter::OnJumpCompleted);
    }

    // 冲刺：按下开始
    if (IA_Sprint)
    {
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnSprintStarted);
    }

    // 冲刺：松开停止
    if (IA_Sprint)
    {
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed,
                                  this, &AMyCharacter::OnSprintCompleted);
    }

    // 蹲伏：按下切换
    if (IA_Crouch)
    {
        EnhancedInput->BindAction(IA_Crouch, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnCrouchToggle);
    }

    // 攻击：按下触发
    if (IA_Attack)
    {
        EnhancedInput->BindAction(IA_Attack, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnAttackStarted);
    }

    // 交互：按下触发
    if (IA_Interact)
    {
        EnhancedInput->BindAction(IA_Interact, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnInteractStarted);
    }
}
```

### 3.2 激活 InputMappingContext

```cpp
void AMyCharacter::BeginPlay()
{
    Super::BeginPlay();

    // ===== 激活 InputMappingContext =====

    // 获取 PlayerController（玩家控制器）
    APlayerController* PC = Cast<APlayerController>(GetController());
    if (!PC)
    {
        // 如果还没被控制（例如刚生成），静默返回
        return;
    }

    // 获取 EnhancedInputLocalPlayerSubsystem
    // 这是 Enhanced Input 的"管理器"，负责处理所有 Context 的激活/停用
    UEnhancedInputLocalPlayerSubsystem* Subsystem =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
            PC->GetLocalPlayer());

    if (!Subsystem)
    {
        // 确保子系统已初始化
        return;
    }

    // 激活默认输入上下文
    if (IMC_Default)
    {
        // AddMappingContext 的参数:
        //   参数1: Context资产
        //   参数2: 优先级（0是最低，数值越大优先级越高）
        Subsystem->AddMappingContext(IMC_Default, 0);
    }
}
```

> **关键细节**：`BeginPlay` 是激活 IMC 的合适时机。在角色被 PlayerController 控制之后，输入系统就已经就绪了。如果在构造函数中激活，此时 Controller 可能还是 nullptr。

---

## 四、ETriggerEvent 详解

### 4.1 五种触发事件

`ETriggerEvent` 定义了"什么时候通知C++回调"。它与 InputAction 上的 Trigger 和 IMC 上的 Trigger 协同工作。

```
┌────────────────────────────────────────────────────────────┐
│  ETriggerEvent 枚举值                                       │
├──────────────┬─────────────────────────────────────────────┤
│  Started     │ 动作"开始"时触发一次                          │
│              │ 对应：按键刚按下，或摇杆从0变为非0             │
│              │ 适用：单次动作（跳跃、开枪、互动）              │
├──────────────┼─────────────────────────────────────────────┤
│  Triggered   │ 动作"进行中"时持续触发（通常是每帧）            │
│              │ 对应：按键按住期间，或摇杆持续偏移              │
│              │ 适用：持续动作（移动、视角、油门）              │
├──────────────┼─────────────────────────────────────────────┤
│  Ongoing     │ 动作"持续进行"时持续触发                       │
│              │ 类似 Triggered，但语义不同：                   │
│              │ 用于动作没有"完成"的状态                       │
│              │ 用得较少，通常用 Triggered 即可                 │
├──────────────┼─────────────────────────────────────────────┤
│  Completed   │ 动作"完成/结束"时触发一次                      │
│              │ 对应：按键松开，或摇杆归零                     │
│              │ 适用：松开扳机、松开跳跃、蓄力结束              │
├──────────────┼─────────────────────────────────────────────┤
│  Canceled    │ 动作被"取消"时触发一次                         │
│              │ 对应：Context被移除，或更高优先级Context抢走输入 │
│              │ 适用：清理状态，防止"卡按键"                   │
│              │ 例如：开着菜单时松开W键，游戏模式收不到Release   │
│              │       你就收到了 Canceled                     │
└──────────────┴─────────────────────────────────────────────┘
```

### 4.2 一个按键的完整生命周期

```
玩家按下W键并保持，然后松开：

时间轴:   ──────┬──────┬──────┬──────┬──────┬──────
                │ 按下  │      │      │ 松开 │
                ▼       ▼      ▼      ▼      ▼
事件:          Started   Triggered  Triggered  Completed
                (1次)    (每帧)     (每帧)     (1次)

如果Context被移除（例如打开了菜单）：
                Started   Triggered  ← 菜单打开 →
                                             Canceled
                                             (1次)
```

### 4.3 选择指南

| 动作类型 | 选择的事件 | 原因 |
|----------|-----------|------|
| 移动（WASD按住走路） | `Triggered` | 需要持续获取输入值 |
| 视角（鼠标移动） | `Triggered` | 鼠标每帧都在动 |
| 跳跃（按下跳） | `Started` | 只需要触发一次 |
| 跳跃（松开时停止） | `Completed` | 可选的功能 |
| 冲刺（按住跑） | `Started` + `Completed` | 开始冲刺和停止冲刺 |
| 蹲伏（切换） | `Started` | 按一次切换 |
| 开火（单发） | `Started` | 点一下射一发 |
| 开火（连射） | `Started` + `Triggered` | 按住所住持续开火 |
| 交互（E键） | `Started` | 按一下互动 |
| 蓄力攻击（按住蓄力） | `Started` + `Completed` | 开始蓄力 + 松开发射 |
| 清理状态（防止卡按键） | `Canceled` | 安全兜底 |

### 4.4 Canceled 的重要性

```cpp
// ===== ❌ 没有处理 Canceled 可能导致的Bug =====

void AMyCharacter::OnSprintStarted(const FInputActionValue& Value)
{
    bIsSprinting = true;           // 标记为冲刺中
    GetCharacterMovement()->MaxWalkSpeed = 1200.0f;  // 加速
}

void AMyCharacter::OnSprintCompleted(const FInputActionValue& Value)
{
    bIsSprinting = false;          // 标记停止冲刺
    GetCharacterMovement()->MaxWalkSpeed = 600.0f;   // 恢复速度
}

// Bug场景:
// 1. 玩家按住Shift冲刺 → bIsSprinting = true, 速度1200
// 2. 玩家按下ESC打开菜单 → 游戏Context被屏蔽
// 3. 玩家在菜单中松开Shift → 松开事件被UI Context拦截
// 4. Completed 回调不会触发！
// 5. 玩家关闭菜单回来 → bIsSprinting 仍然是 true！
// 6. 角色继续以1200的速度移动，但玩家并没有按Shift！

// ===== ✅ 正确处理 Canceled =====

void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ...
    if (IA_Sprint)
    {
        // 绑定 Started
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnSprintStarted);
        // 绑定 Completed
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed,
                                  this, &AMyCharacter::OnSprintCompleted);
        // ✅ 绑定 Canceled（关键！）
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Canceled,
                                  this, &AMyCharacter::OnSprintCanceled);
        // Canceled 和 Completed 可以共用同一个函数
        // 因为它们都需要做同样的事：重置状态
    }
}

void AMyCharacter::OnSprintCanceled(const FInputActionValue& Value)
{
    // 和 Completed 做同样的事：重置冲刺状态
    bIsSprinting = false;
    GetCharacterMovement()->MaxWalkSpeed = 600.0f;
}
```

---

## 五、输入回调函数的实现

### 5.1 回调函数签名

所有通过 `BindAction` 绑定的回调函数都必须遵循以下签名之一：

```cpp
// 签名1: 获取 FInputActionValue（推荐，最常用）
void OnXxx(const FInputActionValue& Value);

// 签名2: 不获取值（用于 Bool 类型，不需要值的时候）
void OnXxx();

// ⚠️ 不推荐：旧输入系统的 float 签名
void OnXxx(float Value);  // Enhanced Input 中尽量不用这个
```

### 5.2 从 FInputActionValue 中提取值

```cpp
#include "InputActionValue.h"

void AMyCharacter::SomeCallback(const FInputActionValue& Value)
{
    // FInputActionValue 是一个"类型安全的输入值包装"
    // 通过 ValueType 存储不同类型的值
    
    // ===== 提取 Bool =====
    bool bPressed = Value.Get<bool>();
    // 适用场景：跳跃、冲刺、交互、开火等开关型动作
    
    // ===== 提取 float（Axis1D）=====
    float AxisValue = Value.Get<float>();
    // 适用场景：油门、刹车、滚轮缩放
    
    // ===== 提取 FVector2D（Axis2D）=====
    FVector2D Vec2 = Value.Get<FVector2D>();
    float X = Vec2.X;   // 左右分量
    float Y = Vec2.Y;   // 前后分量
    // 适用场景：移动方向、鼠标视角
    
    // ===== 提取 FVector（Axis3D）=====
    FVector Vec3 = Value.Get<FVector>();
    // 适用场景：飞行模拟（几乎很少用到）
}
```

### 5.3 移动输入（Axis2D）完整实现

```cpp
void AMyCharacter::OnMove(const FInputActionValue& Value)
{
    // ===== 第1步：提取二维向量 =====
    // Value 是一个 Axis2D 类型的输入值
    // .X = 左右分量（-1.0左 ~ +1.0右）
    // .Y = 前后分量（-1.0后 ~ +1.0前）
    FVector2D MovementVector = Value.Get<FVector2D>();

    // ===== 第2步：检查是否有控制器 =====
    // GetController() 返回当前控制这个Pawn的Controller
    // 可能是 APlayerController（玩家控制） 或 AAIController（AI控制）
    if (IsValid(GetController()))
    {
        // ===== 第3步：获取控制器的旋转（只取Yaw）=====
        // GetControlRotation(): 获取Control的完整旋转（Pitch, Yaw, Roll）
        // FRotator: 包含 Pitch（俯仰）, Yaw（偏航）, Roll（翻滚）
        FRotator ControlRotation = GetController()->GetControlRotation();
        
        // 我们只关心水平面的方向（Yaw），忽略上下（Pitch）
        // 因为角色是在地面上水平移动的（不考虑飞行）
        FRotator YawRotation(0.0f,                    // Pitch = 0
                              ControlRotation.Yaw,     // 保留偏航
                              0.0f);                   // Roll = 0

        // ===== 第4步：计算移动方向 =====
        // FRotationMatrix: 把旋转矩阵化，方便取方向向量
        // GetUnitAxis(EAxis::X): 获取"前方"的单位向量
        FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
        
        // GetUnitAxis(EAxis::Y): 获取"右方"的单位向量
        FVector RightDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

        // ===== 第5步：添加移动输入 =====
        // AddMovementInput 是 APawn 的方法
        // 参数1: 世界方向向量
        // 参数2: 缩放值（-1.0到1.0），代表输入强度
        // 引擎内部会累积这些值，最终由 MovementComponent 处理

        // 前后移动：MovementVector.Y
        //   W键 → +1.0 → 向前
        //   S键 → -1.0 → 向后
        AddMovementInput(ForwardDirection, MovementVector.Y);

        // 左右移动：MovementVector.X
        //   D键 → +1.0 → 向右
        //   A键 → -1.0 → 向左
        AddMovementInput(RightDirection, MovementVector.X);
    }
}
```

### 5.4 视角控制（Axis2D）—— 鼠标/右摇杆

```cpp
void AMyCharacter::OnLook(const FInputActionValue& Value)
{
    // ===== 第1步：提取二维向量 =====
    // 鼠标:
    //   .X = 水平移动（左右）
    //   .Y = 垂直移动（上下）
    // 手柄右摇杆:
    //   .X = 水平偏移（左右转）
    //   .Y = 垂直偏移（上下看）
    FVector2D LookAxisVector = Value.Get<FVector2D>();

    // ===== 第2步：水平转向（Yaw）=====
    if (IsValid(GetController()))
    {
        // AddControllerYawInput: 绕Z轴旋转（左右看）
        // 参数: 旋转量（正值=右转，负值=左转）
        // LookAxisVector.X 直接作为旋转量使用
        AddControllerYawInput(LookAxisVector.X);
    }

    // ===== 第3步：垂直转向（Pitch）=====
    // AddControllerPitchInput: 绕Y轴旋转（上下看）
    // 参数: 旋转量（正值=抬头，负值=低头）
    // ACharacter 会自动钳制 Pitch 范围（默认-90到90度）
    AddControllerPitchInput(LookAxisVector.Y);
}
```

### 5.5 跳跃（Bool）—— Started + Completed

```cpp
void AMyCharacter::OnJumpStarted(const FInputActionValue& Value)
{
    // ACharacter 内置了 Jump() 方法
    // 它处理了:
    //   1. 检查是否在地上（只能在地面起跳）
    //   2. 应用跳跃速度
    //   3. 播放跳跃动画（如果配置了）
    //   4. 进入 Falling 状态
    Jump();
}

void AMyCharacter::OnJumpCompleted(const FInputActionValue& Value)
{
    // StopJumping() 的作用:
    //   1. 如果角色正在上升，提前结束上升（短按跳得低）
    //   2. 防止"按住空格连跳"（如果是这样设计的）
    //   3. 重置跳跃相关的内部状态
    //
    // 注释掉 StopJumping() 的效果：
    //   按住空格 → 角色跳得最高（JumpMaxHoldTime决定）
    //   轻点空格 → 角色跳得最低
    //
    // 保留 StopJumping() 的效果：
    //   松开空格 → 立刻停止上升，统一跳跃高度
    StopJumping();
}
```

### 5.6 冲刺（Bool）—— Started + Completed + Canceled

```cpp
void AMyCharacter::OnSprintStarted(const FInputActionValue& Value)
{
    // 获取角色的移动组件
    UCharacterMovementComponent* Movement = GetCharacterMovement();
    if (Movement)
    {
        // 设置冲刺时的高速度
        // 600 是ACharacter的默认走路速度
        // 1200 是两倍速的冲刺速度
        // 实际项目中这个值应该用UPROPERTY配置
        Movement->MaxWalkSpeed = 1200.0f;
    }
    bIsSprinting = true;
}

void AMyCharacter::OnSprintCompleted(const FInputActionValue& Value)
{
    // 松开Shift → 恢复走路速度
    UCharacterMovementComponent* Movement = GetCharacterMovement();
    if (Movement)
    {
        Movement->MaxWalkSpeed = 600.0f;
    }
    bIsSprinting = false;
}

// ✅ 处理Canceled防止"卡状态"
void AMyCharacter::OnSprintCanceled(const FInputActionValue& Value)
{
    // 和 Completed 做同样的事情
    // （或者直接调用 OnSprintCompleted(Value)）
    UCharacterMovementComponent* Movement = GetCharacterMovement();
    if (Movement)
    {
        Movement->MaxWalkSpeed = 600.0f;
    }
    bIsSprinting = false;
}
```

### 5.7 蹲伏切换（Bool）—— Started

```cpp
void AMyCharacter::OnCrouchToggle(const FInputActionValue& Value)
{
    // ACharacter 内置了蹲伏支持，但需要手动启用

    // CanCrouch() 检查是否允许蹲伏
    // 需要在 MovementComponent 中设置 GetNavAgentPropertiesRef().bCanCrouch = true
    if (GetCharacterMovement()->CanCrouch())
    {
        // bIsCrouched 是 ACharacter 的内置变量
        // Crouch() 蹲下
        // UnCrouch() 站起
        if (bIsCrouched)
        {
            UnCrouch();  // 已经在蹲 → 站起来
        }
        else
        {
            Crouch();    // 站着 → 蹲下去
        }
    }
}
```

### 5.8 攻击/交互（Bool）—— Started

```cpp
void AMyCharacter::OnAttackStarted(const FInputActionValue& Value)
{
    // 播放攻击动画（需要在AnimBP中配置）
    // PlayAnimMontage 播放动画蒙太奇
    // 具体实现见"章节案例"
    
    UE_LOG(LogTemp, Log, TEXT("攻击！"));
}

void AMyCharacter::OnInteractStarted(const FInputActionValue& Value)
{
    // 执行射线检测，看面前有没有可交互的物体
    // 具体实现见"章节案例"
    
    UE_LOG(LogTemp, Log, TEXT("交互！"));
}
```

---

## 六、手柄支持

### 6.1 手柄按键映射对照

在 InputMappingContext 中为手柄按键绑定：

| Xbox 按键 | 通用名称（UE中使用这个） | 典型游戏用途 |
|-----------|------------------------|-------------|
| A (下方按钮) | Gamepad Face Button Bottom | 跳跃 |
| B (右边按钮) | Gamepad Face Button Right | 蹲伏 / 取消 |
| X (左边按钮) | Gamepad Face Button Left | 交互 / 换弹 |
| Y (上方按钮) | Gamepad Face Button Top | 切换武器 |
| 左摇杆 | Gamepad Left Thumbstick 2D | 移动 |
| 按下左摇杆 | Gamepad Left Thumbstick Button | 冲刺 |
| 右摇杆 | Gamepad Right Thumbstick 2D | 视角 |
| 按下右摇杆 | Gamepad Right Thumbstick Button | 锁定目标 / 近战 |
| 左扳机 (LT) | Gamepad Left Trigger | 瞄准 |
| 右扳机 (RT) | Gamepad Right Trigger | 开火 |
| 左肩键 (LB) | Gamepad Left Shoulder | 使用技能 |
| 右肩键 (RB) | Gamepad Right Shoulder | 投掷 |
| 十字键上 | Gamepad D-pad Up | 切换物品/武器 |
| 十字键下 | Gamepad D-pad Down | 使用物品 |
| 十字键左 | Gamepad D-pad Left | 上一个 |
| 十字键右 | Gamepad D-pad Right | 下一个 |
| Start | Gamepad Special Right | 暂停/菜单 |
| Select | Gamepad Special Left | 地图/背包 |

### 6.2 如何在 IMC 中添加手柄绑定

```
操作步骤（以跳跃为例）:

1. 打开 IMC_Default
2. 找到 IA_Jump 的映射条目
3. 点击 [+] 添加新按键
4. 在按键选择器中，点击 Gamepad 类别
5. 选择 "Gamepad Face Button Bottom"（Xbox的A键）
6. 不需要设置 Scale（Bool类型不需要Scale）

一个映射条目可以同时绑定多个不同设备的按键：
  IA_Jump:
    → Space Bar              （键盘）
    → Gamepad Face Button Bottom  （Xbox手柄）
    → 触摸屏 单点              （手机）

所有这些按键都会触发同一个 IA_Jump，并调用同一个 OnJumpStarted()
```

---

## 七、BindAction 的优先级版本

Enhanced Input 支持带优先级的绑定，优先级高的回调先于优先级低的执行：

```cpp
// ===== 普通绑定（优先级为0）=====
EnhancedInput->BindAction(IA_Attack, ETriggerEvent::Started,
                          this, &AMyCharacter::OnNormalAttack);

// ===== 优先级绑定（高优先级回调先执行）=====
EnhancedInput->BindAction(IA_Attack, ETriggerEvent::Started,
                          this, &AMyCharacter::OnPriorityAttack,
                          /*Priority*/ 100);

// 什么场景需要优先级？
// 例1: 多个Ability需要监听同一个按键
//   - 近战武器绑定 IA_Attack, Priority=0
//   - 远程武器绑定 IA_Attack, Priority=10
//   - 你可以先检查是否有特殊状态，再fallback到普通处理

// 例2: 故障安全（Fail-Safe）
//   - 主逻辑绑定 IA_Interact, Priority=0
//   - 调试日志绑定 IA_Interact, Priority=-100
//   - 调试日志只在主逻辑没有处理时记录（但注意，两个都会执行）
```

---

## 八、完整可运行的代码示例

下面是一个最小可用、可直接编译的角色类：

### MyCharacter.h

```cpp
#pragma once

#include "CoreMinimal.h"
#include "InputActionValue.h"
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"

class UInputAction;
class UInputMappingContext;

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AMyCharacter();

protected:
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(
        class UInputComponent* PlayerInputComponent) override;

    // ===== Input 资产引用 =====
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputMappingContext> IMC_Default;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Move;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Look;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Jump;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Sprint;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
    TObjectPtr<UInputAction> IA_Crouch;

    // ===== 回调函数 =====
    void OnMove(const FInputActionValue& Value);
    void OnLook(const FInputActionValue& Value);
    void OnJumpStarted(const FInputActionValue& Value);
    void OnJumpCompleted(const FInputActionValue& Value);
    void OnSprintStarted(const FInputActionValue& Value);
    void OnSprintCompleted(const FInputActionValue& Value);
    void OnSprintCanceled(const FInputActionValue& Value);
    void OnCrouchToggle(const FInputActionValue& Value);
};
```

### MyCharacter.cpp

```cpp
#include "MyCharacter.h"

// Enhanced Input 相关头文件
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"

// ACharacter 内置功能需要的头文件
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"

// ===== 构造函数 =====
AMyCharacter::AMyCharacter()
{
    // 允许角色每帧调用 Tick
    PrimaryActorTick.bCanEverTick = true;

    // 获取移动组件，配置蹲伏
    UCharacterMovementComponent* Movement = GetCharacterMovement();
    if (Movement)
    {
        // 允许蹲伏（默认 ACharacter 不允许蹲伏！）
        Movement->GetNavAgentPropertiesRef().bCanCrouch = true;
    }
}

// ===== BeginPlay =====
void AMyCharacter::BeginPlay()
{
    Super::BeginPlay();

    // 获取 PlayerController
    APlayerController* PC = Cast<APlayerController>(GetController());
    if (!PC)
    {
        return;
    }

    // 获取 Enhanced Input 子系统
    UEnhancedInputLocalPlayerSubsystem* Subsystem =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
            PC->GetLocalPlayer());

    if (Subsystem && IMC_Default)
    {
        // 激活默认输入上下文
        Subsystem->AddMappingContext(IMC_Default, 0);
    }
}

// ===== 绑定输入 =====
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EnhancedInput =
        CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // 移动
    if (IA_Move)
    {
        EnhancedInput->BindAction(IA_Move, ETriggerEvent::Triggered,
                                  this, &AMyCharacter::OnMove);
    }

    // 视角
    if (IA_Look)
    {
        EnhancedInput->BindAction(IA_Look, ETriggerEvent::Triggered,
                                  this, &AMyCharacter::OnLook);
    }

    // 跳跃
    if (IA_Jump)
    {
        EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnJumpStarted);
        EnhancedInput->BindAction(IA_Jump, ETriggerEvent::Completed,
                                  this, &AMyCharacter::OnJumpCompleted);
    }

    // 冲刺
    if (IA_Sprint)
    {
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnSprintStarted);
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Completed,
                                  this, &AMyCharacter::OnSprintCompleted);
        EnhancedInput->BindAction(IA_Sprint, ETriggerEvent::Canceled,
                                  this, &AMyCharacter::OnSprintCanceled);
    }

    // 蹲伏
    if (IA_Crouch)
    {
        EnhancedInput->BindAction(IA_Crouch, ETriggerEvent::Started,
                                  this, &AMyCharacter::OnCrouchToggle);
    }
}

// ===== 移动 =====
void AMyCharacter::OnMove(const FInputActionValue& Value)
{
    FVector2D MovementVector = Value.Get<FVector2D>();

    if (IsValid(GetController()))
    {
        // 只取 Yaw（水平旋转），忽略 Pitch 和 Roll
        const FRotator YawRotation(0.0f,
                                    GetController()->GetControlRotation().Yaw,
                                    0.0f);

        const FVector ForwardDirection =
            FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
        const FVector RightDirection =
            FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

        // MovementVector.Y: W(+1.0) / S(-1.0)
        AddMovementInput(ForwardDirection, MovementVector.Y);
        // MovementVector.X: D(+1.0) / A(-1.0)
        AddMovementInput(RightDirection, MovementVector.X);
    }
}

// ===== 视角 =====
void AMyCharacter::OnLook(const FInputActionValue& Value)
{
    FVector2D LookAxisVector = Value.Get<FVector2D>();

    if (IsValid(GetController()))
    {
        // 水平转：鼠标X / 右摇杆X
        AddControllerYawInput(LookAxisVector.X);
        // 垂直转：鼠标Y / 右摇杆Y
        AddControllerPitchInput(LookAxisVector.Y);
    }
}

// ===== 跳跃 =====
void AMyCharacter::OnJumpStarted(const FInputActionValue& Value)
{
    Jump();
}

void AMyCharacter::OnJumpCompleted(const FInputActionValue& Value)
{
    StopJumping();
}

// ===== 冲刺 =====
void AMyCharacter::OnSprintStarted(const FInputActionValue& Value)
{
    if (UCharacterMovementComponent* Movement = GetCharacterMovement())
    {
        Movement->MaxWalkSpeed = 1200.0f;
    }
}

void AMyCharacter::OnSprintCompleted(const FInputActionValue& Value)
{
    if (UCharacterMovementComponent* Movement = GetCharacterMovement())
    {
        Movement->MaxWalkSpeed = 600.0f;
    }
}

void AMyCharacter::OnSprintCanceled(const FInputActionValue& Value)
{
    // 和 Completed 做一样的事：重置速度
    if (UCharacterMovementComponent* Movement = GetCharacterMovement())
    {
        Movement->MaxWalkSpeed = 600.0f;
    }
}

// ===== 蹲伏 =====
void AMyCharacter::OnCrouchToggle(const FInputActionValue& Value)
{
    if (GetCharacterMovement()->CanCrouch())
    {
        if (bIsCrouched)
        {
            UnCrouch();  // 站起来
        }
        else
        {
            Crouch();    // 蹲下去
        }
    }
}
```

---

## ✅ 完成检查清单

- [ ] 知道在 Build.cs 中需要添加 `"EnhancedInput"` 到 `PrivateDependencyModuleNames` 吗？
- [ ] 理解为什么 .h 中推荐用前向声明而不是 #include 完整头文件？
- [ ] 能说出 ETriggerEvent 的 5 种类型，以及它们各自适用的场景吗？
- [ ] 理解 Started → Triggered → Completed 的完整生命周期吗？
- [ ] 理解 Canceled 的意义？知道不处理 Canceled 会导致什么 Bug 吗？
- [ ] 能从 `FInputActionValue` 中提取 `bool`、`float`、`FVector2D`、`FVector` 吗？
- [ ] 能写出完整的移动输入回调（包含方向向量计算）吗？
- [ ] 能写出鼠标视角控制吗？知道 AddControllerYawInput 和 AddControllerPitchInput 的区别？
- [ ] 知道如何在 IMC 中给手柄按键绑定吗？
- [ ] 能独立写一个包含移动、视角、跳跃、冲刺、蹲伏的完整 Character 类吗？
- [ ] 知道 BindAction 的优先级参数有什么用吗？

---

> **下一步**：[7.4 章节案例](./04-章节案例.md) —— 实现一个完整的多输入模式角色控制系统。