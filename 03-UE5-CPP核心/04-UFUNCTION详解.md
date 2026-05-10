# 3.4 UFUNCTION 详解

> **目标**：全面掌握UFUNCTION的说明符，理解蓝图如何调用C++函数，C++如何调用蓝图事件。

---

## 为什么需要UFUNCTION？

```cpp
// 没有UFUNCTION
void TakeDamage(float Amount);  // 只是一个普通C++函数
// 蓝图看不到它，不能调用它

// 有UFUNCTION
UFUNCTION(BlueprintCallable)
void TakeDamage(float Amount);  // 蓝图可以调用了！
```

UFUNCTION让UE的反射系统知道这个函数，从而赋予它额外的"超能力"。

---

## UFUNCTION说明符分类速查

### 蓝图交互类（最常用）

| 说明符 | C++端 | 蓝图端 | 使用场景 |
|--------|-------|--------|---------|
| `BlueprintCallable` | 有实现 | 可调用 | C++写了逻辑，蓝图来调用 |
| `BlueprintImplementableEvent` | **无实现** | 写实现 | C++定义接口，蓝图实现逻辑 |
| `BlueprintNativeEvent` | 有默认实现 | **可选覆写** | C++有默认逻辑，蓝图可选择覆写 |
| `BlueprintPure` | 有实现，不能改状态 | 可调用（纯函数） | 计算/查询函数，不修改任何东西 |

### 网络类（第12章详解）

| 说明符 | 效果 |
|--------|------|
| `Server` | 只在服务器上执行 |
| `Client` | 只在拥有该Actor的客户端执行 |
| `NetMulticast` | 服务器调用，所有客户端执行 |
| `Reliable` | 保证送达（RPC） |
| `Unreliable` | 不保证送达（高频调用用这个） |
| `WithValidation` | 服务器RPC需要验证函数 |

### 其他

| 说明符 | 效果 |
|--------|------|
| `CallInEditor` | 可以在编辑器细节面板中点击调用 |
| `Exec` | 可以在控制台中输入命令调用 |
| `Static` | 静态函数 |

---

## BlueprintCallable — C++写了，蓝图调用

```cpp
// .h 声明
UFUNCTION(BlueprintCallable, Category = "Combat")
//        ─────────┬────────
// 关键参数：蓝图可以调用这个函数
void TakeDamage(float DamageAmount);

UFUNCTION(BlueprintCallable, Category = "Combat")
float GetHealthPercent() const;

// .cpp 实现（照常写就行）
void AMyCharacter::TakeDamage(float DamageAmount)
{
    Health -= DamageAmount;
    if (Health <= 0.0f)
    {
        Die();
    }
}

float AMyCharacter::GetHealthPercent() const
{
    return (MaxHealth > 0.0f) ? Health / MaxHealth : 0.0f;
}
```

在蓝图中，你可以像调用蓝图函数一样调用这些C++实现的函数。

---

## BlueprintImplementableEvent — C++定义，蓝图实现

```cpp
// .h 声明（注意：没有函数体！不写实现！）
UFUNCTION(BlueprintImplementableEvent, Category = "Events")
//        ──────────────┬─────────────
// 函数签名在C++，实现在蓝图
void OnHealthChanged(float NewHealth, float OldHealth);

UFUNCTION(BlueprintImplementableEvent, Category = "Events")
void OnPlayerDeath();

// .cpp 中不需要实现！调用它会自动转到蓝图
// 使用时像普通函数一样调用：
void AMyCharacter::TakeDamage(float Amount)
{
    float OldHealth = Health;
    Health -= Amount;
    OnHealthChanged(Health, OldHealth);  // 调用 → 蓝图中的实现被执行
}
```

在蓝图中：事件图表中会自动出现 `OnHealthChanged` 和 `OnPlayerDeath` 事件节点，你在蓝图里连线写逻辑。

---

## BlueprintNativeEvent — C++有默认，蓝图可选覆写

```cpp
// .h 声明
UFUNCTION(BlueprintNativeEvent, Category = "Combat")
void CalculateDamage(float& OutDamage);
//                     ↑ 引用参数：可以在函数内修改这个值

// .cpp 实现（注意函数名后面有 _Implementation）
void AMyCharacter::CalculateDamage_Implementation(float& OutDamage)
//                           ──────────────
//                     BlueprintNativeEvent的实现函数必须加 _Implementation 后缀
{
    // C++的默认实现
    OutDamage = BaseAttack * StrengthMultiplier;
}

// 调用时用原始函数名，不用加_Implementation
void AMyCharacter::Attack()
{
    float FinalDamage = 0.0f;
    CalculateDamage(FinalDamage);  // 如果蓝图覆写了，调蓝图版本；否则调C++版本
    ApplyDamage(FinalDamage);
}
```

在蓝图中：可以选择覆写 `CalculateDamage`，写自己的伤害计算公式。如果蓝图没覆写，就用C++的默认公式。

### 三种蓝图函数的对比总结

| 类型 | C++实现 | 蓝图实现 | 谁说了算 |
|------|---------|---------|---------|
| `BlueprintCallable` | 有 | 无 | C++ |
| `BlueprintImplementableEvent` | 无 | 有 | 蓝图 |
| `BlueprintNativeEvent` | 有（默认）| 可选 | 蓝图优先（覆写了就用篮图的）|

---

## BlueprintPure — 纯函数（不修改数据）

```cpp
// BlueprintPure = 蓝图中的"纯函数"（绿色节点）
// 特征：没有执行引脚（不需要执行流），直接输出返回值
UFUNCTION(BlueprintPure, Category = "Combat")
float GetHealthPercent() const;  // const是必须的，因为纯函数不应该修改状态

UFUNCTION(BlueprintPure, Category = "Combat")
bool IsAlive() const;

UFUNCTION(BlueprintPure, Category = "Combat")
FVector GetAimDirection() const;
```

在蓝图中，`BlueprintPure` 函数**没有执行引脚**（白色箭头），只有数据引脚。每次调用时都会重新计算。

> **何时用 BlueprintCallable vs BlueprintPure？**
> - BlueprintPure：纯计算，不改变任何状态。如 `GetHealthPercent()`, `IsAlive()`, `GetSpeed()`
> - BlueprintCallable：可能有副作用。如 `TakeDamage()`, `Jump()`, `FireWeapon()`

---

## Server / Client / NetMulticast — 网络RPC

```cpp
// RPC = Remote Procedure Call（远程过程调用）

// 客户端调用 → 在服务器上执行
UFUNCTION(Server, Reliable, WithValidation)
void ServerFireWeapon(FVector TargetLocation);

// 服务器调用 → 在拥有此Actor的客户端上执行
UFUNCTION(Client, Reliable)
void ClientPlayDamageEffect(float Damage);

// 服务器调用 → 在所有客户端上执行（广播）
UFUNCTION(NetMulticast, Unreliable)
void MulticastPlayExplosion(FVector Location);

// 实现时要写 _Implementation 和 _Validate
void AMyCharacter::ServerFireWeapon_Implementation(FVector TargetLocation)
{
    // 服务器上的开火逻辑
}

bool AMyCharacter::ServerFireWeapon_Validate(FVector TargetLocation)
{
    // 验证参数是否合法（防作弊）
    return TargetLocation.Size() < 10000.0f;
}
```

详细内容见第12章。这里先知道有这些选项。

---

## CallInEditor — 编辑器中点击调用

```cpp
// 在编辑器中选中Actor → 细节面板 → 出现一个按钮
UFUNCTION(CallInEditor, Category = "Debug")
void DebugResetHealth();

void AMyCharacter::DebugResetHealth()
{
    Health = MaxHealth;
    UE_LOG(LogTemp, Warning, TEXT("血量已重置为 %f"), Health);
}
```

这在调试时非常有用——改代码后不用运行游戏就能测试函数。

---

## Exec — 控制台命令

```cpp
// 在游戏运行时，按 ~ 打开控制台，输入 MyCommand 就能调用
UFUNCTION(Exec)
void MyCommand(float Param1, int32 Param2);
```

---

## 完整实例：一个功能齐全的角色类

```cpp
UCLASS(Blueprintable)
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ----- 蓝图可调用的C++函数 -----
    UFUNCTION(BlueprintCallable, Category = "Combat")
    void TakeDamage(float DamageAmount);

    UFUNCTION(BlueprintCallable, Category = "Movement")
    void Sprint(bool bEnable);

    // ----- 蓝图纯函数（查询）-----
    UFUNCTION(BlueprintPure, Category = "Combat")
    float GetHealthPercent() const;

    UFUNCTION(BlueprintPure, Category = "Combat")
    bool IsAlive() const { return Health > 0.0f; }

    // ----- 蓝图实现事件 -----
    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnDamageReceived(float Damage, FVector HitLocation);

    UFUNCTION(BlueprintImplementableEvent, Category = "Events")
    void OnDeath();

    // ----- 蓝图可选覆写事件 -----
    UFUNCTION(BlueprintNativeEvent, Category = "Combat")
    float CalculateFinalDamage(float RawDamage);
    // 默认实现在.cpp中写 CalculateFinalDamage_Implementation

    // ----- 编辑器调试 -----
    UFUNCTION(CallInEditor, Category = "Debug")
    void DebugKillCharacter();  // 编辑器中一键杀角色

    // ----- 网络RPC -----
    UFUNCTION(Server, Reliable, WithValidation)
    void ServerRequestRevive();

private:
    float Health = 100.0f;
    float MaxHealth = 100.0f;
};
```

---

## 完成检查清单

- [ ] 区分 BlueprintCallable / BlueprintImplementableEvent / BlueprintNativeEvent
- [ ] 知道 BlueprintNativeEvent 的实现函数要加 `_Implementation` 后缀
- [ ] 理解 BlueprintPure 和 BlueprintCallable 的区别
- [ ] 知道 CallInEditor 的用途（编辑器调试）
- [ ] 了解 Server/Client/NetMulticast 的基本概念
