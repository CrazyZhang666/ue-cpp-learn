# 8.2 C++创建与使用Widget

> **目标**：掌握在C++中创建、显示、隐藏和销毁Widget的全部流程。

---

## 目录
1. [前置知识确认](#1-前置知识确认)
2. [创建C++ Widget类](#2-创建c-widget类)
3. [BindWidget：绑定C++变量到蓝图控件](#3-bindwidget绑定c变量到蓝图控件)
4. [代码中创建Widget](#4-代码中创建widget)
5. [将Widget添加到视口](#5-将widget添加到视口)
6. [从视口移除Widget](#6-从视口移除widget)
7. [显示与隐藏Widget](#7-显示与隐藏widget)
8. [创建HUD的完整流程](#8-创建hud的完整流程)
9. [多个Widget的管理](#9-多个widget的管理)

---

## 1. 前置知识确认

在开始之前，请确保你已经：
- [ ] 至少在编辑器中创建过一个Widget Blueprint
- [ ] 了解CanvasPanel、Overlay等基本容器
- [ ] 知道Button、TextBlock、ProgressBar等基本控件
- [ ] 了解C++中的UPROPERTY宏的基本用法
- [ ] 会使用UE编辑器的"创建C++类"功能

如果以上有任何不熟悉的，先回看 [01-UMG基础](./01-UMG基础.md) 或在项目中实际操作一遍。

---

## 2. 创建C++ Widget类

### 2.1 第一步：创建C++类

在UE编辑器中：

1. 点击顶部菜单 `Tools → New C++ Class...`
2. 在弹出的窗口中，向下滚动找到 `All Classes` 区域
3. 搜索 `UserWidget`
4. 选择 `UserWidget` 作为父类
5. 点击 `Next`
6. 给类取一个有意义的名字（如 `UMainHUD`、`UInventoryWidget`）
7. 点击 `Create Class`

```
命名规范建议：
✅ UMainHUD              ← 用 U 前缀，名字清晰
✅ UInventoryWidget
✅ UMainMenuWidget
❌ MyWidget1             ← 名字没有说明用途
❌ UIHUD                 ← 虽然是U前缀但被改成了UI
```

### 2.2 第二步：理解生成的头文件

创建完成后，UE会生成`.h`和`.cpp`两个文件。先看头文件：

```cpp
// 文件：MainHUD.h
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"  // ← 必须包含UserWidget的头文件
#include "MainHUD.generated.h"     // ← UE生成代码的头文件，必须放在最后

/**
 * 主游戏HUD类
 * 负责显示游戏中的血条、弹药、小地图等信息
 */
UCLASS()  // ← 这个宏告诉UE这是一个可反射的类
class YOURPROJECT_API UMainHUD : public UUserWidget  // ← 继承自UUserWidget
{
    GENERATED_BODY()  // ← UE自动生成的代码占位符，每个UCLASS都要有

public:
    // 构造函数
    UMainHUD(const FObjectInitializer& ObjectInitializer);

    // 虚函数重写（生命周期函数）
    virtual void NativeConstruct() override;  // Widget被创建时调用
    virtual void NativeDestruct() override;   // Widget被销毁时调用
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;  // 每帧调用

protected:
    // 在这里声明要绑定到蓝图的控件变量
};
```

**逐行解释：**

```cpp
#include "Blueprint/UserWidget.h"
```
这行导入了 `UUserWidget` 类的定义，没有它你就无法继承 `UUserWidget`。

```cpp
#include "MainHUD.generated.h"
```
这行**必须放在所有include的最后面**，它是UE的反射系统自动生成的头文件。如果把其他include放在它后面，编译会报错！

```cpp
UCLASS()
```
`UCLASS()` 宏告诉虚幻引擎的反射系统："这个类需要被UE管理"。没有这个宏，你就不能在蓝图中继承这个C++类。

```cpp
GENERATED_BODY()
```
这是一个占位符，UE在编译前会自动在此处生成大量样板代码（包括 `UClass` 对象的创建、属性注册等）。每个 `UCLASS` 都必须包含它。

```cpp
virtual void NativeConstruct() override;
```
`NativeConstruct()` 是 `UUserWidget` 提供的一个虚函数，在这个Widget的蓝图完成构造（`Construct`节点之后）时被调用。在这里初始化UI元素是**最安全**的做法，因为此时蓝图中的所有控件都已经创建完毕。

```cpp
virtual void NativeDestruct() override;
```
`NativeDestruct()` 在Widget即将被销毁时调用。适合在这里做清理工作：取消定时器、取消事件绑定、释放资源等。

```cpp
virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
```
`NativeTick()` 每帧调用一次。`MyGeometry` 包含了Widget的几何信息（位置、大小），`InDeltaTime` 是距离上一帧的时间间隔（秒）。**注意：** 默认情况下Widget不会Tick，需要在构造函数中启用：
```cpp
bHasScriptImplementedTick = true; // 在构造函数中启用Tick
```

### 2.3 完整的基础头文件模板

```cpp
// 文件：MyWidget.h
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "MyWidget.generated.h"

/**
 * Widget类的简要说明
 */
UCLASS()
class YOURPROJECT_API UMyWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    // ==================== 构造函数 ====================
    // 使用ObjectInitializer初始化对象
    UMyWidget(const FObjectInitializer& ObjectInitializer);

    // ==================== 生命周期函数 ====================
    // Widget被创建后，蓝图Construct节点执行完毕后调用
    virtual void NativeConstruct() override;

    // Widget即将被销毁时调用
    virtual void NativeDestruct() override;

    // 每帧调用（需要在构造函数中启用 bHasScriptImplementedTick = true）
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

protected:
    // ==================== 绑定的控件变量 ====================
    // 在这里用BindWidget声明要绑定的控件

private:
    // ==================== 内部数据 ====================
    // 在这里声明Widget需要的内部变量
};
```

### 2.4 对应的cpp文件模板

```cpp
// 文件：MyWidget.cpp
#include "MyWidget.h"

// ==================== 构造函数 ====================
UMyWidget::UMyWidget(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)  // ← 必须调用父类的构造函数
{
    // 如果你的Widget不需要每帧更新，就不要启用Tick（节省性能！）
    // bHasScriptImplementedTick = true; // 启用Tick（默认false）
}

// ==================== NativeConstruct ====================
void UMyWidget::NativeConstruct()
{
    // ★ 必须先调用父类的实现，否则父类的初始化逻辑不会执行
    Super::NativeConstruct();

    // 在这里写初始化逻辑
    // 例如：绑定按钮事件、初始化显示文字等
    UE_LOG(LogTemp, Log, TEXT("MyWidget 被创建并初始化了！"));
}

// ==================== NativeDestruct ====================
void UMyWidget::NativeDestruct()
{
    // 在这里做清理工作
    // 例如：取消定时器、移除事件监听等
    UE_LOG(LogTemp, Log, TEXT("MyWidget 即将被销毁！"));

    // ★ 父类的清理也要调用
    Super::NativeDestruct();
}

// ==================== NativeTick ====================
void UMyWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    // ★ 调用父类的Tick
    Super::NativeTick(MyGeometry, InDeltaTime);

    // 在这里写每帧需要更新的逻辑
    // 例如：更新血条、刷新计时器等
}
```

✅ **检查清单 - 2.1~2.4：**
- [ ] 成功创建了一个继承自UUserWidget的C++类
- [ ] 理解.generated.h必须放在最后
- [ ] 知道NativeConstruct、NativeDestruct、NativeTick的调用时机
- [ ] 知道需要在构造函数中设置 `bHasScriptImplementedTick` 才能启用Tick
- [ ] 每个重写的虚函数都调用了Super::父类版本

---

## 3. BindWidget：绑定C++变量到蓝图控件

### 3.1 什么是BindWidget

**一句话理解：** `BindWidget` 让你在C++代码中声明一个"占位符"，然后UE会自动把蓝图中同名的控件"对号入座"赋值给这个占位符。

```
C++代码中声明：
    UPROPERTY(meta = (BindWidget))
    UTextBlock* HealthText;  ← 占位符，名字叫 "HealthText"

蓝图中有一个控件：
    TextBlock，名字叫 "HealthText"  ← 同名！

结果：
    自动绑定！C++代码中的 HealthText 指针指向蓝图中的那个 TextBlock 控件
```

### 3.2 BindWidget的工作流程

```
步骤1：在C++头文件中声明变量，加上 BindWidget 元数据
        ↓
步骤2：编译C++代码
        ↓
步骤3：在编辑器中创建基于这个C++类的Widget Blueprint
        ↓
步骤4：在Widget Blueprint中添加一个控件，名字必须和C++变量名一致
        ↓
步骤5：运行时，UE自动把同名控件绑定到C++变量
```

### 3.3 BindWidget示例代码

```cpp
// 文件：MainHUD.h
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Components/TextBlock.h"       // ← 需要用到TextBlock，所以要包含它的头文件
#include "Components/ProgressBar.h"     // ← 需要用到ProgressBar
#include "Components/Button.h"          // ← 需要用到Button
#include "Components/Image.h"           // ← 需要用到Image
#include "MainHUD.generated.h"

UCLASS()
class YOURPROJECT_API UMainHUD : public UUserWidget
{
    GENERATED_BODY()

public:
    // ==================== 通过BindWidget绑定的控件（命名必须和蓝图中的控件名一致！）====================

    // 血条进度条 — 绑定到蓝图中名为 "HealthBar" 的ProgressBar控件
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UProgressBar> HealthBar;

    // 血量数字 — 绑定到蓝图中名为 "HealthText" 的TextBlock控件
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> HealthText;

    // 弹药文字 — 绑定到蓝图中名为 "AmmoText" 的TextBlock控件
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> AmmoText;

    // 小地图图片 — 绑定到蓝图中名为 "MiniMapImage" 的Image控件
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UImage> MiniMapImage;

    // 暂停按钮 — 绑定到蓝图中名为 "PauseButton" 的Button控件
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UButton> PauseButton;
};
```

**关键规则（非常重要！）：**

```
✅ C++变量名 == 蓝图控件名（大小写敏感！必须完全一致）
✅ 变量类型必须和控件类型匹配（UTextBlock* 对应 TextBlock 控件）
✅ 使用 BindWidget 时变量必须是 TObjectPtr<T> 类型
✅ 在蓝图中控件的名字要设置对（在Details面板顶部修改名字）

❌ 变量名叫 "HealthBar"，但蓝图中控件叫 "healthbar" ← 大小写不一致，绑定失败！
❌ UImage* 类型但却想绑定 TextBlock 控件 ← 类型不匹配
❌ 忘记在蓝图中创建对应名字的控件 ← 运行时指针为nullptr
```

### 3.4 BindWidgetOptional（可选绑定）

有时候你希望某个控件"有就绑定，没有也行"。使用 `BindWidgetOptional`：

```cpp
// BindWidgetOptional：如果蓝图中有同名的控件就自动绑定
// 如果没有也不会报错（指针为nullptr）
UPROPERTY(meta = (BindWidgetOptional))
TObjectPtr<UTextBlock> OptionalText; // ← 这个控件不是必须存在的
```

**区别总结：**

| 宏 | 蓝图中必须存在？ | 不存在时的行为 |
|----|-----------------|---------------|
| `BindWidget` | 是，必须有同名控件 | 编译警告，运行时为nullptr |
| `BindWidgetOptional` | 否，可以没有 | 运行时为nullptr，不报错 |

### 3.5 BindWidgetAnim（绑定动画）

`BindWidgetAnim` 是 `BindWidget` 的变体，专门用于绑定UMG中的动画：

```cpp
// 绑定蓝图中创建的动画
// 蓝图中动画资源名必须和变量名一致
UPROPERTY(meta = (BindWidgetAnim))
TObjectPtr<UWidgetAnimation> FadeInAnimation; // ← 绑定名为"FadeInAnimation"的动画

// 可选绑定动画
UPROPERTY(meta = (BindWidgetAnimOptional))
TObjectPtr<UWidgetAnimation> OptionalFadeOutAnimation; // ← 可选的动画绑定
```

**在代码中播放动画：**
```cpp
void UMyWidget::PlayFadeIn()
{
    if (FadeInAnimation)
    {
        // PlayAnimation：播放动画
        // 参数1：要播放的动画资源
        // 参数2：起始时间（0.0f从第0秒开始）
        // 参数3：循环次数（1 = 播放1次，0 = 无限循环）
        // 参数4：播放模式（EUMGSequencePlayMode::Forward = 正向播放）
        // 参数5：播放速度（1.0f = 正常速度）
        PlayAnimation(FadeInAnimation, 0.0f, 1,
            EUMGSequencePlayMode::Forward, 1.0f);
    }
}
```

✅ **检查清单 - 3.1~3.5：**
- [ ] 理解BindWidget的作用：C++变量名和蓝图控件名必须一致
- [ ] 知道如何使用BindWidget在头文件中声明控件变量
- [ ] 理解BindWidget和BindWidgetOptional的区别
- [ ] 知道BindWidgetAnim用于绑定动画
- [ ] 能正确包含所需控件的头文件（TextBlock.h, ProgressBar.h等）

---

## 4. 代码中创建Widget

### 4.1 CreateWidget：创建Widget的核心函数

**一句话理解：** `CreateWidget<T>()` 就像工厂的生产线，你告诉它要生产什么类型的Widget，它就给你一个创建好的Widget实例。

```cpp
// 函数签名（记住这个模式）
template<class T>
T* CreateWidget(UObject* OwningObject, TSubclassOf<UUserWidget> WidgetClass, FName WidgetName = NAME_None);
```

### 4.2 基本用法：一步创建Widget

```cpp
// ==================== 创建Widget的基本步骤 ====================

// 步骤1：准备Widget的类引用（需要在蓝图中设置，或者在代码中加载）
// 方式A：从UPROPERTY中获取（推荐，在蓝图/C++中设置）
// TSubclassOf<UUserWidget> MyWidgetClass; // 在头文件中声明

// 方式B：从资源路径加载
// TSubclassOf<UUserWidget> MyWidgetClass = LoadClass<UUserWidget>(
//     nullptr,
//     TEXT("/Game/UI/WBP_MainHUD.WBP_MainHUD_C")  // 蓝图资源的路径 + _C 后缀
// );

// 步骤2：调用CreateWidget创建实例
UUserWidget* CreatedWidget = CreateWidget<UUserWidget>(
    GetWorld(),         // 参数1：拥有者（通常是World或PlayerController）
    MyWidgetClass,      // 参数2：Widget的类引用（要创建哪种Widget）
    TEXT("MyWidget")    // 参数3：可选的名字（用于调试）
);

// 步骤3：检查是否创建成功
if (CreatedWidget)
{
    UE_LOG(LogTemp, Log, TEXT("Widget创建成功！"));
}
else
{
    UE_LOG(LogTemp, Error, TEXT("Widget创建失败！检查WidgetClass是否有效"));
}
```

### 4.3 详细讲解：CreateWidget的三个参数

**参数1：OwningObject（拥有者）**

这个Widget"属于"谁。常用的拥有者：

```cpp
// 常见的拥有者选择：
GetWorld()                  // Widget属于当前世界（游戏世界）
GetOwningPlayer()           // Widget属于当前玩家控制器（在UserWidget内部调用时）
GetGameInstance()           // Widget属于游戏实例（跨关卡持久存在）
this                        // 在PlayerController或HUD类中，直接用this
```

```
✅ 大多数游戏UI（HUD、菜单、背包）用 GetWorld() 即可
✅ 跨关卡不变的UI（如背景音乐控制器）用 GetGameInstance()
❌ 不要用nullptr作为拥有者（会导致GC问题！）
```

**参数2：WidgetClass（要创建的类型）**

告诉 `CreateWidget` 你要创建哪种Widget：

```cpp
// 方式A：使用TSubclassOf变量（最推荐）
UPROPERTY(EditDefaultsOnly, Category = "UI")
TSubclassOf<UUserWidget> MainHUDClass; // ← 在蓝图/C++中指定具体的Widget蓝图

// 使用：
UMainHUD* HUD = CreateWidget<UMainHUD>(GetWorld(), MainHUDClass);

// 方式B：使用静态Class
UMainHUD* HUD = CreateWidget<UMainHUD>(GetWorld(), UMainHUD::StaticClass());
// ⚠️ 注意：StaticClass()返回C++基类，不能获取蓝图中添加的控件！
// 这种方式只在纯粹的C++Widget（不依赖蓝图中的控件）时使用

// 方式C：从路径加载蓝图类
TSubclassOf<UUserWidget> LoadedClass = LoadClass<UUserWidget>(
    nullptr,
    TEXT("/Game/UI/WBP_MainHUD.WBP_MainHUD_C")  // ★ 注意路径后有 _C 后缀！
);

// 方式D：使用FClassFinder（在构造函数中加载）
static ConstructorHelpers::FClassFinder<UUserWidget> WidgetFinder(
    TEXT("/Game/UI/WBP_MainHUD")  // ★ FClassFinder不需要 _C 后缀
);
if (WidgetFinder.Succeeded())
{
    MainHUDClass = WidgetFinder.Class;
}
```

```
✅ 推荐方式A：通过UPROPERTY暴露给蓝图选择（灵活，易于配置）
✅ 方式C/D：适合固定路径的Widget（但路径硬编码，不够灵活）
❌ 方式B的StaticClass：如果Widget依赖蓝图中的BindWidget，会导致控件绑定失败
❌ LoadClass路径忘了加 _C 后缀 → 加载失败！
```

**参数3：WidgetName（可选的名字）**

给Widget一个名字，主要用于调试：

```cpp
CreateWidget<UUserWidget>(GetWorld(), MyClass, TEXT("MyHUD"));
// 在World Outliner或Widget Reflector中，这个Widget会显示为 "MyHUD"
```

### 4.4 创建带具体类型的Widget（推荐）

在实际项目中，很少直接创建 `UUserWidget`，而是创建自己定义的子类：

```cpp
// ✅ 推荐：创建具体的子类型
UMainHUD* HUDWidget = CreateWidget<UMainHUD>(GetWorld(), MainHUDClass);

// 创建完成后可以调用子类特有的方法
if (HUDWidget)
{
    HUDWidget->UpdateHealth(0.75f);   // 调用UMainHUD特有的方法
    HUDWidget->UpdateAmmo(30, 120);   // 调用UMainHUD特有的方法
}

// ❌ 不推荐：创建为基类类型，丢失了子类信息
UUserWidget* GenericWidget = CreateWidget<UUserWidget>(GetWorld(), MainHUDClass);
// GenericWidget->UpdateHealth(0.75f);  ← 编译错误！UUserWidget没有这个方法
```

### 4.5 CreateWidget常见错误排查

| 错误现象 | 可能原因 | 解决方法 |
|----------|----------|----------|
| Widget为空(nullptr) | WidgetClass未设置 | 在蓝图/C++中给WidgetClass赋值 |
| Widget为空(nullptr) | 路径加载失败 | 检查资源路径是否正确，加上_C后缀 |
| 控件指针为空 | BindWidget名不匹配 | 确保C++变量名和蓝图控件名完全一致 |
| 控件指针为空 | 使用了StaticClass | 改用蓝图类（TSubclassOf） |
| 编译错误 | 头文件未包含 | 包含对应的控件头文件 |

✅ **检查清单 - 4.1~4.5：**
- [ ] 理解CreateWidget的三个参数及其含义
- [ ] 知道推荐使用TSubclassOf + UPROPERTY的方式设置WidgetClass
- [ ] 理解为什么StaticClass可能导致BindWidget失效
- [ ] 知道LoadClass路径需要 _C 后缀

---

## 5. 将Widget添加到视口

### 5.1 AddToViewport：让Widget显示在屏幕上

**一句话理解：** `CreateWidget` 只是把Widget"制造"出来，但还没有"放"到屏幕上。`AddToViewport` 就是把这个制造好的Widget放到屏幕上让玩家看见。

```cpp
// 创建 + 添加到屏幕的两步走
UMyWidget* MyWidget = CreateWidget<UMyWidget>(GetWorld(), MyWidgetClass);
if (MyWidget)
{
    MyWidget->AddToViewport();  // ← 把Widget放到屏幕上！
}
```

### 5.2 AddToViewport的参数

```cpp
void AddToViewport(
    int32 ZOrder = 0  // ← ZOrder值，越大越靠前（显示在更上层）
);
```

**示例：**
```cpp
// 背景层（ZOrder小）
BackgroundWidget->AddToViewport(0);    // ZOrder = 0，最底层

// 游戏HUD层
HUDWidget->AddToViewport(10);          // ZOrder = 10，在背景之上

// 弹窗层
PopupWidget->AddToViewport(50);        // ZOrder = 50，在HUD之上

// 系统提示层（总是显示在最上面）
NotificationWidget->AddToViewport(100); // ZOrder = 100，最顶层
```

### 5.3 完整示例：创建并显示HUD

```cpp
// 文件：MyPlayerController.cpp
#include "MyPlayerController.h"
#include "Blueprint/UserWidget.h"
#include "UI/MainHUD.h"  // ← 包含你的HUD类头文件

void AMyPlayerController::BeginPlay()
{
    // ★ 必须调用父类的BeginPlay
    Super::BeginPlay();

    // 步骤1：检查WidgetClass是否已设置
    if (!MainHUDClass)
    {
        UE_LOG(LogTemp, Error, TEXT("MainHUDClass 未设置！请在蓝图中指定Widget蓝图"));
        return;
    }

    // 步骤2：创建HUD Widget实例
    MainHUDWidget = CreateWidget<UMainHUD>(this, MainHUDClass);

    // 步骤3：检查创建是否成功
    if (!MainHUDWidget)
    {
        UE_LOG(LogTemp, Error, TEXT("创建MainHUD失败！"));
        return;
    }

    // 步骤4：将HUD添加到屏幕上
    MainHUDWidget->AddToViewport(0);  // ZOrder=0 作为背景HUD层

    UE_LOG(LogTemp, Log, TEXT("HUD创建并显示成功！"));
}
```

### 5.4 AddToViewport的注意事项

```
✅ AddToViewport 只能在 Widget 已创建（非nullptr）时调用
✅ 同一个Widget不要重复调用AddToViewport（会导致显示异常）
✅ 合理规划ZOrder层级，避免UI之间互相遮挡
✅ CreateWidget + AddToViewport 通常在 BeginPlay 中调用

❌ 在构造函数中调用AddToViewport（此时World可能还未初始化）
❌ 忘记检查nullptr就直接调用 → 崩溃！
❌ ZOrder随便设置，导致弹窗被HUD遮挡（应该给弹窗设置更大的ZOrder）
❌ 创建后加到了Viewport就忘记管理了（应该保存指针以便后续操作）
```

✅ **检查清单 - 5.1~5.4：**
- [ ] 理解CreateWidget只是创建，AddToViewport才是显示
- [ ] 知道如何设置ZOrder来控制显示层级
- [ ] 能完成"创建→检查→AddToViewport"的完整流程
- [ ] 理解为什么不能在构造函数中调用AddToViewport

---

## 6. 从视口移除Widget

### 6.1 RemoveFromParent：从屏幕上移除Widget

**一句话理解：** `RemoveFromParent()` 就是把Widget从屏幕上"拿下来"，让它不再显示。

```cpp
// 移除Widget（不再显示，但Widget对象还在内存中）
MyWidget->RemoveFromParent();
```

### 6.2 RemoveFromParent 和 销毁 的区别

这是一个非常重要的概念！新手经常搞混：

```cpp
// ==================== RemoveFromParent ====================
// 只是从屏幕上移除（不再渲染），Widget对象还在内存中
// 之后可以再次 AddToViewport 让它重新显示
MyWidget->RemoveFromParent();
// 此时 MyWidget指针仍然有效，可以继续操作它

MyWidget->AddToViewport();  // ← 可以重新显示！

// ==================== RemoveFromParent + 标记销毁 ====================
// 从屏幕移除，并告诉UE"这个Widget可以回收了"
// 一旦调用就不能再使用了！
MyWidget->RemoveFromParent();
MyWidget->MarkAsGarbage();  // 或者让GC自动处理
MyWidget = nullptr;  // 清空指针，防止误用
```

```
RemoveFromParent() 的效果类似于：
┌──────────────┐          ┌──────────────┐
│ ┌──────────┐ │          │              │
│ │  Widget  │ │  →→→→→  │   屏幕空空    │
│ └──────────┘ │          │              │
│    屏幕       │          │   Widget对象  │
└──────────────┘          │  还在内存中   │
                          └──────────────┘
```

### 6.3 完整示例：显示和移除Widget

```cpp
// 文件：MyPlayerController.h
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "MyPlayerController.generated.h"

class UMainHUD;

UCLASS()
class YOURPROJECT_API AMyPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    // ==================== UI控制函数 ====================

    // 显示HUD
    UFUNCTION(BlueprintCallable, Category = "UI")
    void ShowHUD();

    // 隐藏HUD
    UFUNCTION(BlueprintCallable, Category = "UI")
    void HideHUD();

protected:
    virtual void BeginPlay() override;

private:
    // ==================== Widget类引用 ====================
    // 在蓝图中指定具体的Widget蓝图
    UPROPERTY(EditDefaultsOnly, Category = "UI")
    TSubclassOf<UMainHUD> MainHUDClass;

    // ==================== Widget实例指针 ====================
    // 保存创建后的HUD实例
    UPROPERTY()
    TObjectPtr<UMainHUD> MainHUDWidget;
};
```

```cpp
// 文件：MyPlayerController.cpp
#include "MyPlayerController.h"
#include "UI/MainHUD.h"
#include "Blueprint/UserWidget.h"

void AMyPlayerController::BeginPlay()
{
    Super::BeginPlay();
    // BeginPlay时不自动显示HUD，等需要时再显示
}

void AMyPlayerController::ShowHUD()
{
    // 步骤1：如果还没创建，先创建Widget
    if (!MainHUDWidget)
    {
        // 检查WidgetClass是否有效
        if (!MainHUDClass)
        {
            UE_LOG(LogTemp, Error, TEXT("MainHUDClass 未设置！"));
            return;
        }

        // 创建Widget实例
        MainHUDWidget = CreateWidget<UMainHUD>(this, MainHUDClass);
        if (!MainHUDWidget)
        {
            UE_LOG(LogTemp, Error, TEXT("创建HUD失败！"));
            return;
        }
    }

    // 步骤2：检查是否已经在屏幕上
    if (MainHUDWidget->IsInViewport())
    {
        UE_LOG(LogTemp, Warning, TEXT("HUD已经在屏幕上了，无需重复添加"));
        return;
    }

    // 步骤3：添加到屏幕上
    MainHUDWidget->AddToViewport(0);
    UE_LOG(LogTemp, Log, TEXT("HUD已显示"));
}

void AMyPlayerController::HideHUD()
{
    // 步骤1：检查Widget是否存在
    if (!MainHUDWidget)
    {
        UE_LOG(LogTemp, Warning, TEXT("HUD不存在，无需隐藏"));
        return;
    }

    // 步骤2：检查是否在屏幕上
    if (!MainHUDWidget->IsInViewport())
    {
        UE_LOG(LogTemp, Warning, TEXT("HUD已经不在屏幕上"));
        return;
    }

    // 步骤3：从屏幕移除
    MainHUDWidget->RemoveFromParent();
    UE_LOG(LogTemp, Log, TEXT("HUD已隐藏"));
}
```

✅ **检查清单 - 6.1~6.3：**
- [ ] 理解RemoveFromParent只是从屏幕移除，不销毁Widget对象
- [ ] 知道IsInViewport()可以检查Widget是否在屏幕上
- [ ] 知道在AddToViewport前检查是否已经在屏幕上（防止重复添加）
- [ ] 理解RemoveFromParent后Widget还可以重新AddToViewport

---

## 7. 显示与隐藏Widget

### 7.1 三种控制Widget可见性的方法

| 方法 | 说明 | 适用场景 |
|------|------|----------|
| `AddToViewport / RemoveFromParent` | 添加/移除Widget | 完全不需要Widget时 |
| `SetVisibility(ESlateVisibility)` | 设置可见性状态 | 临时隐藏但保留Widget |
| `SetHiddenInGame(bool)` | 隐藏/显示（保留空间） | 隐藏但保留布局占用（较少用） |

### 7.2 SetVisibility：临时显示/隐藏

**一句话理解：** 不同于 `RemoveFromParent`（拿下来），`SetVisibility` 只是让Widget"透明看不见"，但它还在原来的位置上。

```cpp
// ==================== SetVisibility的用法 ====================

// 完全可见（正常交互）
MyWidget->SetVisibility(ESlateVisibility::Visible);

// 可见但不可交互（灰色显示，点击穿透到下层）
MyWidget->SetVisibility(ESlateVisibility::HitTestInvisible);

// 不可见但占据空间（控件还在布局中占位置，但渲染为透明）
MyWidget->SetVisibility(ESlateVisibility::Hidden);

// 完全不可见且不占据空间（推荐用于隐藏）
MyWidget->SetVisibility(ESlateVisibility::Collapsed);

// 不可交互（可见，但鼠标事件穿透）
MyWidget->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
```

### 7.3 ESlateVisibility 各状态详解

这是一个非常容易混淆的概念，让我用表格清晰说明：

| 枚举值 | 是否可见 | 是否占据空间 | 能否交互（点击） | 典型用途 |
|--------|----------|-------------|-----------------|----------|
| `Visible` | 是 | 是 | 能 | 正常显示的UI |
| `Collapsed` | 否 | **否** | 否 | 隐藏不用的UI（最常用） |
| `Hidden` | 否 | **是** | 否 | 需要保留布局占位时 |
| `HitTestInvisible` | 是 | 是 | **否**（自己和子控件都不能点） | 纯显示文字、装饰图案 |
| `SelfHitTestInvisible` | 是 | 是 | **自己不能点**，但子控件可以 | 容器面板，点穿透到子控件 |
| `NotHitTestable` | 是 | 是 | **自己不能点**，子控件可单独判断 | 和SelfHitTestInvisible类似 |

**直观理解：**

```
Visible（可见可点）：
┌──────────┐
│ 按钮     │  ← 鼠标点这里，按钮响应
│ 可见可点  │
└──────────┘

Collapsed（完全消失）：
                    ← 什么都没有，也不占空间

Hidden（不可见但占空间）：
                    ← 虽然看不见，但这里有一块"空位"
  （此处空间被占用）    下面的元素不会移上来

HitTestInvisible（可见但鼠标穿透）：
┌──────────┐
│ 装饰文字  │  ← 鼠标点击会"穿透"到下面的控件
└──────────┘
```

### 7.4 SetVisibility 实际应用

```cpp
// ==================== 示例：背包界面的打开/关闭 ====================

void UInventoryWidget::OpenInventory()
{
    // 设置背包界面为可见
    SetVisibility(ESlateVisibility::Visible);
    UE_LOG(LogTemp, Log, TEXT("背包已打开"));
}

void UInventoryWidget::CloseInventory()
{
    // 设置背包界面为Collapsed（完全不可见，不占空间）
    SetVisibility(ESlateVisibility::Collapsed);
    UE_LOG(LogTemp, Log, TEXT("背包已关闭"));
}

bool UInventoryWidget::IsInventoryOpen() const
{
    // 检查是否可见
    return GetVisibility() == ESlateVisibility::Visible;
}
```

### 7.5 AddToViewport vs SetVisibility：选择指南

```
什么时候用 RemoveFromParent / AddToViewport？
  ✓ 界面完全不需要了（如：游戏结束，HUD不再需要）
  ✓ 很少切换显示的界面（如：主菜单界面）
  ✓ 需要释放内存时

什么时候用 SetVisibility？
  ✓ 频繁打开/关闭的界面（如：背包、地图）
  ✓ 不需要释放内存（保持状态）
  ✓ 需要快速切换显示/隐藏
```

✅ **检查清单 - 7.1~7.5：**
- [ ] 理解SetVisibility和AddToViewport/RemoveFromParent的区别
- [ ] 知道Collapsed和Hidden的区别（是否占据空间）
- [ ] 知道HitTestInvisible的作用（可见但鼠标穿透）
- [ ] 能根据场景选择正确的显示/隐藏方法

---

## 8. 创建HUD的完整流程

### 8.1 什么是HUD

**HUD（Heads-Up Display）** 就是游戏过程中一直显示在屏幕上的界面元素——血条、弹药数、小地图、准星等。

> "HUD" 这个词来源于战斗机飞行员抬头就能看到仪表盘的设计。

### 8.2 完整流程概览

创建HUD的完整流程分为6个步骤：

```
步骤1：创建C++ Widget类（UMainHUD）
        │
步骤2：在类中声明BindWidget控件变量
        │
步骤3：创建Widget Blueprint并布局控件
        │
步骤4：在PlayerController中管理HUD的创建和销毁
        │
步骤5：在游戏开始时创建并显示HUD
        │
步骤6：游戏过程中更新HUD显示内容
```

### 8.3 步骤1：创建C++ Widget类

```cpp
// 文件：MainHUD.h
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Components/ProgressBar.h"   // ProgressBar控件
#include "Components/TextBlock.h"     // TextBlock控件
#include "MainHUD.generated.h"

/**
 * 主游戏HUD
 * 显示血条、弹药、分数等游戏信息
 */
UCLASS()
class YOURPROJECT_API UMainHUD : public UUserWidget
{
    GENERATED_BODY()

public:
    // 构造函数
    UMainHUD(const FObjectInitializer& ObjectInitializer);

    // ==================== 公开的更新方法 ====================
    // 这些方法由PlayerController或其他系统调用，用于更新HUD显示

    // 更新血量显示
    // @param CurrentHealth 当前血量
    // @param MaxHealth 最大血量
    void UpdateHealth(float CurrentHealth, float MaxHealth);

    // 更新弹药显示
    // @param CurrentAmmo 当前弹药数
    // @param MaxAmmo 最大弹药数
    void UpdateAmmo(int32 CurrentAmmo, int32 MaxAmmo);

    // 更新分数显示
    // @param NewScore 新分数
    void UpdateScore(int32 NewScore);

protected:
    virtual void NativeConstruct() override;

private:
    // ==================== 绑定的控件（BindWidget） ====================
    // 这些变量的名字必须和蓝图中对应的控件名字完全一致

    // 血条进度条 → 绑定蓝图中名为 "HealthBar" 的ProgressBar
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UProgressBar> HealthBar;

    // 血量文字 → 绑定蓝图中名为 "HealthText" 的TextBlock
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> HealthText;

    // 弹药文字 → 绑定蓝图中名为 "AmmoText" 的TextBlock
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> AmmoText;

    // 分数文字 → 绑定蓝图中名为 "ScoreText" 的TextBlock
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> ScoreText;
};
```

```cpp
// 文件：MainHUD.cpp
#include "MainHUD.h"
#include "Math/Color.h"

// ==================== 构造函数 ====================
UMainHUD::UMainHUD(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
{
    // HUD不需要每帧Tick，保持默认false即可（节省性能）
    // 只在收到更新时才刷新显示
}

// ==================== NativeConstruct ====================
void UMainHUD::NativeConstruct()
{
    Super::NativeConstruct();

    // 初始化所有显示为默认值
    UpdateHealth(100.0f, 100.0f);  // 满血
    UpdateAmmo(30, 30);            // 弹药满
    UpdateScore(0);                // 分数0
}

// ==================== UpdateHealth ====================
void UMainHUD::UpdateHealth(float CurrentHealth, float MaxHealth)
{
    // 步骤1：计算血量百分比（0.0 ~ 1.0）
    float HealthPercent = 0.0f;
    if (MaxHealth > 0.0f)
    {
        HealthPercent = CurrentHealth / MaxHealth;
        // 限制在 0.0 ~ 1.0 范围内，防止越界
        HealthPercent = FMath::Clamp(HealthPercent, 0.0f, 1.0f);
    }

    // 步骤2：更新进度条
    if (HealthBar)
    {
        HealthBar->SetPercent(HealthPercent);

        // 根据血量百分比改变血条颜色（视觉效果）
        if (HealthPercent > 0.5f)
        {
            // 血量 > 50%，绿色
            HealthBar->SetFillColorAndOpacity(FLinearColor::Green);
        }
        else if (HealthPercent > 0.25f)
        {
            // 血量 25%~50%，黄色（警告）
            HealthBar->SetFillColorAndOpacity(FLinearColor::Yellow);
        }
        else
        {
            // 血量 < 25%，红色（危险！）
            HealthBar->SetFillColorAndOpacity(FLinearColor::Red);
        }
    }

    // 步骤3：更新血量文字
    if (HealthText)
    {
        // 使用FText::Format进行格式化字符串拼接
        HealthText->SetText(FText::Format(
            FText::FromString(TEXT("{0} / {1}")),  // 显示格式："100 / 100"
            FText::AsNumber(FMath::RoundToInt(CurrentHealth)),  // {0} = 当前血量
            FText::AsNumber(FMath::RoundToInt(MaxHealth))       // {1} = 最大血量
        ));
    }
}

// ==================== UpdateAmmo ====================
void UMainHUD::UpdateAmmo(int32 CurrentAmmo, int32 MaxAmmo)
{
    if (AmmoText)
    {
        // 格式化弹药显示："30 / 120"
        AmmoText->SetText(FText::Format(
            FText::FromString(TEXT("{0} / {1}")),
            FText::AsNumber(CurrentAmmo),
            FText::AsNumber(MaxAmmo)
        ));

        // 弹药不足时变红色提醒
        if (CurrentAmmo <= MaxAmmo * 0.2f)  // 弹药低于20%时
        {
            AmmoText->SetColorAndOpacity(FSlateColor(FLinearColor::Red));
        }
        else
        {
            AmmoText->SetColorAndOpacity(FSlateColor(FLinearColor::White));
        }
    }
}

// ==================== UpdateScore ====================
void UMainHUD::UpdateScore(int32 NewScore)
{
    if (ScoreText)
    {
        ScoreText->SetText(FText::Format(
            FText::FromString(TEXT("分数: {0}")),
            FText::AsNumber(NewScore)
        ));
    }
}
```

### 8.4 步骤2：在PlayerController中管理HUD

```cpp
// 文件：MyPlayerController.h
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "MyPlayerController.generated.h"

class UMainHUD;  // 前向声明（避免在头文件中包含太多文件）

UCLASS()
class YOURPROJECT_API AMyPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    // ==================== HUD控制 ====================

    // 创建并显示HUD
    UFUNCTION(BlueprintCallable, Category = "HUD")
    void CreateAndShowHUD();

    // 移除并销毁HUD
    UFUNCTION(BlueprintCallable, Category = "HUD")
    void RemoveHUD();

    // 获取HUD实例（供外部调用）
    UFUNCTION(BlueprintCallable, Category = "HUD")
    UMainHUD* GetMainHUD() const { return MainHUDWidget; }

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    // ==================== HUD配置 ====================
    // 要创建的HUD的蓝图类（在派生蓝图中设置）
    UPROPERTY(EditDefaultsOnly, Category = "HUD")
    TSubclassOf<UMainHUD> MainHUDClass;

    // HUD实例指针
    UPROPERTY()
    TObjectPtr<UMainHUD> MainHUDWidget;
};
```

```cpp
// 文件：MyPlayerController.cpp
#include "MyPlayerController.h"
#include "UI/MainHUD.h"
#include "Blueprint/UserWidget.h"

void AMyPlayerController::BeginPlay()
{
    Super::BeginPlay();

    // 游戏开始时创建并显示HUD
    CreateAndShowHUD();
}

void AMyPlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // 游戏结束时清理HUD
    RemoveHUD();

    Super::EndPlay(EndPlayReason);
}

void AMyPlayerController::CreateAndShowHUD()
{
    // 步骤1：防止重复创建
    if (MainHUDWidget)
    {
        UE_LOG(LogTemp, Warning, TEXT("HUD已存在，跳过创建"));
        return;
    }

    // 步骤2：检查Widget类是否已设置
    if (!MainHUDClass)
    {
        UE_LOG(LogTemp, Error, TEXT("MainHUDClass未设置！请在蓝图中选择HUD蓝图"));
        return;
    }

    // 步骤3：创建HUD Widget实例
    MainHUDWidget = CreateWidget<UMainHUD>(this, MainHUDClass);
    if (!MainHUDWidget)
    {
        UE_LOG(LogTemp, Error, TEXT("创建HUD Widget失败！"));
        return;
    }

    // 步骤4：添加到视口
    // ZOrder = 0，作为底层HUD
    MainHUDWidget->AddToViewport(0);

    UE_LOG(LogTemp, Log, TEXT("HUD创建并显示成功！"));
}

void AMyPlayerController::RemoveHUD()
{
    if (MainHUDWidget)
    {
        // 从屏幕移除
        MainHUDWidget->RemoveFromParent();

        // 清空指针（让GC回收Widget对象）
        MainHUDWidget = nullptr;

        UE_LOG(LogTemp, Log, TEXT("HUD已移除"));
    }
}
```

### 8.5 步骤3：更新HUD数据

在PlayerController或其他游戏逻辑中，调用HUD的更新方法：

```cpp
// 示例：在PlayerController中处理玩家血量变化
void AMyPlayerController::OnPlayerHealthChanged(float CurrentHealth, float MaxHealth)
{
    // 获取HUD实例并更新显示
    if (UMainHUD* HUD = GetMainHUD())
    {
        HUD->UpdateHealth(CurrentHealth, MaxHealth);
    }
}

// 示例：在武器类中更新弹药
void AWeapon::Fire()
{
    CurrentAmmo--;

    // 通知HUD更新弹药显示
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        if (AMyPlayerController* MyPC = Cast<AMyPlayerController>(PC))
        {
            if (UMainHUD* HUD = MyPC->GetMainHUD())
            {
                HUD->UpdateAmmo(CurrentAmmo, MaxAmmo);
            }
        }
    }
}
```

✅ **检查清单 - 8.1~8.5：**
- [ ] 理解HUD的完整创建流程（6个步骤）
- [ ] 能编写MainHUD类的完整代码
- [ ] 能在PlayerController中管理HUD的创建和销毁
- [ ] 理解如何在其他类中获取HUD并更新显示
- [ ] 知道在EndPlay中清理HUD

---

## 9. 多个Widget的管理

### 9.1 为什么需要管理多个Widget

一个真实的游戏中，同时会有很多Widget在运行：

```
游戏运行中同时存在的UI：
┌─────────────────────────┐
│  UMainHUD        ← 底层，一直显示
│  ├── 血条、弹药、分数
│  └── 小地图
│
│  UInventoryWidget ← 中层，按Tab打开/关闭
│  ├── 物品网格
│  └── 物品说明
│
│  UDialogWidget    ← 上层，对话时显示
│  ├── 对话文字
│  └── 选项按钮
│
│  UPauseMenuWidget ← 最上层，按ESC打开
│  ├── 继续游戏
│  ├── 设置
│  └── 退出
└─────────────────────────┘
```

### 9.2 创建一个UI管理器

对于复杂的UI系统，建议创建一个专门的Manager来管理所有Widget：

```cpp
// 文件：UIManager.h
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "UIManager.generated.h"

class UMainHUD;
class UInventoryWidget;
class UPauseMenuWidget;
class UDialogWidget;

/**
 * UI管理器
 * 集中管理游戏中所有的Widget，统一控制创建、显示、隐藏和销毁
 */
UCLASS()
class YOURPROJECT_API UUIManager : public UObject
{
    GENERATED_BODY()

public:
    // ==================== 初始化与清理 ====================
    // 初始化UI管理器（创建所有需要的Widget）
    void Initialize(APlayerController* InOwner);

    // 清理所有Widget
    void Shutdown();

    // ==================== HUD相关 ====================
    // 显示/隐藏HUD
    void ShowHUD();
    void HideHUD();

    // 更新HUD数据
    void UpdateHealth(float Current, float Max);
    void UpdateAmmo(int32 Current, int32 Max);

    // ==================== 背包相关 ====================
    // 打开/关闭背包
    void ToggleInventory();

    // ==================== 暂停菜单相关 ====================
    // 打开/关闭暂停菜单
    void TogglePauseMenu();

    // ==================== 对话框相关 ====================
    // 显示对话框
    void ShowDialog(const FText& DialogText);

    // 关闭对话框
    void CloseDialog();

private:
    // ==================== Widget类配置 ====================
    // 这些在Initialize时通过传入的参数设置

    UPROPERTY()
    TSubclassOf<UMainHUD> MainHUDClass;

    UPROPERTY()
    TSubclassOf<UInventoryWidget> InventoryWidgetClass;

    UPROPERTY()
    TSubclassOf<UPauseMenuWidget> PauseMenuWidgetClass;

    UPROPERTY()
    TSubclassOf<UDialogWidget> DialogWidgetClass;

    // ==================== Widget实例 ====================
    UPROPERTY()
    TObjectPtr<APlayerController> OwnerPC;

    UPROPERTY()
    TObjectPtr<UMainHUD> MainHUDWidget;

    UPROPERTY()
    TObjectPtr<UInventoryWidget> InventoryWidget;

    UPROPERTY()
    TObjectPtr<UPauseMenuWidget> PauseMenuWidget;

    UPROPERTY()
    TObjectPtr<UDialogWidget> DialogWidget;

    // ==================== 内部辅助方法 ====================

    // 创建一个Widget的通用模板方法
    template<typename T>
    T* CreateAndAddWidget(TSubclassOf<T> WidgetClass, int32 ZOrder = 0)
    {
        if (!WidgetClass || !OwnerPC)
        {
            return nullptr;
        }

        T* NewWidget = CreateWidget<T>(OwnerPC, WidgetClass);
        if (NewWidget)
        {
            NewWidget->AddToViewport(ZOrder);
        }
        return NewWidget;
    }
};
```

```cpp
// 文件：UIManager.cpp
#include "UIManager.h"
#include "UI/MainHUD.h"
#include "UI/InventoryWidget.h"
#include "UI/PauseMenuWidget.h"
#include "UI/DialogWidget.h"
#include "GameFramework/PlayerController.h"

// ==================== Initialize ====================
void UUIManager::Initialize(APlayerController* InOwner)
{
    // 保存Owner
    OwnerPC = InOwner;
    if (!OwnerPC)
    {
        UE_LOG(LogTemp, Error, TEXT("UIManager: OwnerPC为空，初始化失败！"));
        return;
    }

    // 创建并显示HUD（ZOrder=0，底层）
    if (MainHUDClass)
    {
        MainHUDWidget = CreateAndAddWidget<UMainHUD>(MainHUDClass, 0);
    }

    // 预创建背包Widget但不显示（等玩家按Tab时才显示）
    // 注意：这里创建但不AddToViewport，节省ZOrder管理
    if (InventoryWidgetClass)
    {
        InventoryWidget = CreateWidget<UInventoryWidget>(OwnerPC, InventoryWidgetClass);
        // 创建后先不添加到视口，设为Collapsed
        if (InventoryWidget)
        {
            InventoryWidget->SetVisibility(ESlateVisibility::Collapsed);
        }
    }

    // 预创建暂停菜单Widget
    if (PauseMenuWidgetClass)
    {
        PauseMenuWidget = CreateWidget<UPauseMenuWidget>(OwnerPC, PauseMenuWidgetClass);
        if (PauseMenuWidget)
        {
            PauseMenuWidget->SetVisibility(ESlateVisibility::Collapsed);
        }
    }

    UE_LOG(LogTemp, Log, TEXT("UIManager初始化完成"));
}

// ==================== Shutdown ====================
void UUIManager::Shutdown()
{
    // 清理所有Widget
    if (MainHUDWidget)
    {
        MainHUDWidget->RemoveFromParent();
        MainHUDWidget = nullptr;
    }

    if (InventoryWidget)
    {
        InventoryWidget->RemoveFromParent();
        InventoryWidget = nullptr;
    }

    if (PauseMenuWidget)
    {
        PauseMenuWidget->RemoveFromParent();
        PauseMenuWidget = nullptr;
    }

    if (DialogWidget)
    {
        DialogWidget->RemoveFromParent();
        DialogWidget = nullptr;
    }

    OwnerPC = nullptr;
    UE_LOG(LogTemp, Log, TEXT("UIManager已清理"));
}

// ==================== ToggleInventory ====================
void UUIManager::ToggleInventory()
{
    if (!InventoryWidget)
    {
        return;
    }

    // 判断当前状态并切换
    if (InventoryWidget->GetVisibility() == ESlateVisibility::Visible)
    {
        // 背包当前是打开的 → 关闭
        InventoryWidget->SetVisibility(ESlateVisibility::Collapsed);
    }
    else
    {
        // 背包当前是关闭的 → 打开
        // 需要先添加到视口（如果还没添加的话）
        if (!InventoryWidget->IsInViewport())
        {
            InventoryWidget->AddToViewport(10);  // ZOrder=10
        }
        InventoryWidget->SetVisibility(ESlateVisibility::Visible);
    }
}

// ==================== TogglePauseMenu ====================
void UUIManager::TogglePauseMenu()
{
    if (!PauseMenuWidget)
    {
        return;
    }

    if (PauseMenuWidget->GetVisibility() == ESlateVisibility::Visible)
    {
        // 关闭暂停菜单
        PauseMenuWidget->SetVisibility(ESlateVisibility::Collapsed);
        // 恢复游戏时间
        if (OwnerPC)
        {
            OwnerPC->SetPause(false);
        }
    }
    else
    {
        // 打开暂停菜单
        if (!PauseMenuWidget->IsInViewport())
        {
            PauseMenuWidget->AddToViewport(100);  // ZOrder=100，最上层
        }
        PauseMenuWidget->SetVisibility(ESlateVisibility::Visible);
        // 暂停游戏
        if (OwnerPC)
        {
            OwnerPC->SetPause(true);
        }
    }
}
```

### 9.3 ZOrder分层策略

为不同层次的UI规划ZOrder范围，避免冲突：

```cpp
// ==================== ZOrder分层规范 ====================
namespace UIZOrder
{
    constexpr int32 Background  = 0;    // 背景层（纯装饰）
    constexpr int32 HUD         = 10;   // 游戏HUD层（血条、弹药等）
    constexpr int32 GameUI      = 20;   // 游戏内UI（背包、地图等）
    constexpr int32 Popup       = 50;   // 弹窗层（提示、确认框）
    constexpr int32 Menu        = 80;   // 菜单层（暂停菜单、设置）
    constexpr int32 System      = 100;  // 系统层（通知、加载画面）
    constexpr int32 Debug       = 200;  // 调试层（开发用）
}

// 使用示例：
MainHUDWidget->AddToViewport(UIZOrder::HUD);         // ZOrder = 10
InventoryWidget->AddToViewport(UIZOrder::GameUI);     // ZOrder = 20
PopupWidget->AddToViewport(UIZOrder::Popup);          // ZOrder = 50
PauseMenuWidget->AddToViewport(UIZOrder::Menu);       // ZOrder = 80
```

### 9.4 Widget管理的注意事项

```
✅ 使用专门的UIManager类集中管理所有Widget，而不是散落在各处
✅ 为ZOrder制定分层规范，避免UI遮挡混乱
✅ 频繁开关的Widget使用SetVisibility，不频繁的用AddToViewport/RemoveFromParent
✅ 在合适的时机清理Widget（关卡切换、游戏结束等）
✅ 保存Widget指针时记得加UPROPERTY()（防止被GC回收）

❌ 在多个地方创建同一个Widget（应该由UIManager统一创建）
❌ 忘记设置UPROPERTY()导致Widget被GC回收（变成野指针）
❌ ZOrder随便设置，导致重要的弹窗被HUD遮挡
❌ 关卡切换时忘记清理Widget（导致Widget残留或引用无效的World）
```

✅ **检查清单 - 9.1~9.4：**
- [ ] 理解为什么需要UI管理器
- [ ] 能编写基本的UIManager类
- [ ] 理解ZOrder分层策略
- [ ] 知道频繁开关的Widget用SetVisibility，不频繁的用AddToViewport

---

## 本章总结

恭喜你完成了C++创建与使用Widget的学习！现在你应该能够：

1. 创建继承自UUserWidget的C++类
2. 使用BindWidget将C++变量绑定到蓝图中的控件
3. 使用CreateWidget创建Widget实例
4. 使用AddToViewport显示Widget，RemoveFromParent移除Widget
5. 使用SetVisibility控制Widget的显示/隐藏
6. 完成创建HUD的完整流程（从C++类到编辑器布局）
7. 管理多个Widget的创建、显示、隐藏和销毁

**下一步：** 进入 [03-数据绑定与事件](./03-数据绑定与事件.md)，学习如何在C++中处理按钮点击、属性绑定和输入模式切换！
