# 3.3 UPROPERTY 详解

> **目标**：全面掌握UPROPERTY的所有说明符，知道如何让属性在编辑器中显示、在蓝图中访问、在网络中同步。

---

## UPROPERTY的核心作用

```cpp
// 没有UPROPERTY的成员变量
int32 MyValue;  // UE系统完全不知道这个变量的存在
// 后果：
// ❌ 编辑器细节面板看不到
// ❌ 蓝图中访问不了
// ❌ GC不知道它引用了什么（如果是指针）
// ❌ 不能保存/加载（序列化）
// ❌ 不能网络同步

// 有UPROPERTY的成员变量
UPROPERTY(EditAnywhere, BlueprintReadWrite)
int32 MyValue;  // UE系统完全管理这个变量
// ✅ 编辑器可见可编辑
// ✅ 蓝图可读写
// ✅ GC受保护
// ✅ 自动序列化
// ✅ 可以网络同步
```

---

## UPROPERTY说明符分类速查

### 第一类：可见性与可编辑性

| 说明符 | 编辑器可见 | 编辑器可改 | 使用场景 |
|--------|-----------|-----------|---------|
| `VisibleAnywhere` | ✅ | ❌（灰色） | 展示只读信息，如当前血量 |
| `EditAnywhere` | ✅ | ✅ | 可调整的参数，如速度、伤害 |
| `VisibleInstanceOnly` | ✅（仅关卡实例）| ❌ | 只在关卡中的实例可见 |
| `EditInstanceOnly` | ✅（仅关卡实例）| ✅ | 只在关卡中可修改 |
| `VisibleDefaultsOnly` | ✅（仅类默认值）| ❌ | 只在类默认设置中可见 |
| `EditDefaultsOnly` | ✅（仅类默认值）| ✅ | 只能修改类默认值，实例不能改 |

> **"Anywhere" vs "DefaultsOnly" vs "InstanceOnly"**：
> - `Anywhere` = 在类默认设置和每个实例上都能看到/编辑
> - `DefaultsOnly` = 只在类默认设置面板中看/编辑（影响所有实例）
> - `InstanceOnly` = 只在关卡中的具体实例上看/编辑（每个实例可以不同）
>
> 举个例子：`EditDefaultsOnly float MaxHealth = 100`，所有敌人初始血量都是100。但如果你想让关卡中某个特定敌人血量是200，就需要 `EditInstanceOnly`。

### 第二类：蓝图访问

| 说明符 | 蓝图读取 | 蓝图写入 | 使用场景 |
|--------|---------|---------|---------|
| `BlueprintReadOnly` | ✅ | ❌ | 蓝图只读数据（如当前血量） |
| `BlueprintReadWrite` | ✅ | ✅ | 蓝图可读写数据 |
| - | ❌ | ❌ | 纯C++内部使用的变量 |

### 第三类：网络同步

| 说明符 | 效果 |
|--------|------|
| `Replicated` | 标记为需要网络同步 |
| `ReplicatedUsing=OnRep_Function` | 同步后调用回调函数 |
| `NotReplicated` | 明确不复制（默认） |

```cpp
// 网络同步示例
UPROPERTY(ReplicatedUsing = OnRep_Health)
float Health;

UFUNCTION()
void OnRep_Health()  // 客户端收到同步数据后自动调用
{
    // 更新UI、播放受伤动画等
    UpdateHealthBar();
}
```

### 第四类：高级特性

| 说明符 | 效果 |
|--------|------|
| `Transient` | 不序列化（不保存到磁盘） |
| `SaveGame` | 存档系统中保存 |
| `Config` | 保存到.ini配置文件 |
| `Instanced` | 为这个属性创建实例（用于UObject子属性） |
| `Export` | 嵌套UObject的序列化导出 |
| `TextExportTransient` | FText类型不导出到文本 |
| `DuplicateTransient` | 复制对象时不复制这个属性 |
| `NonTransactional` | 不参与Undo/Redo系统 |
| `SkipSerialization` | 完全跳过序列化 |

```cpp
// 临时数据：运行时有值，但不保存
UPROPERTY(Transient)
float CurrentSpeed;  // 每帧变化的速度，不需要保存到磁盘

// 配置数据：永久保存在ini文件
UPROPERTY(Config)
float MusicVolume = 0.8f;

// 存档数据
UPROPERTY(SaveGame)
int32 PlayerLevel;
```

---

## 元数据（Meta）标签

`meta = (...)` 用来给编辑器和蓝图添加"提示信息"：

### 数值相关

```cpp
// 限定数值范围（编辑器中显示为带滑条的输入框）
UPROPERTY(EditAnywhere, meta = (ClampMin = "0", ClampMax = "100"))
float HealthPercent;

// UIMin/UIMax：滑条的可视范围（但用户可以手动输入超出范围的值）
UPROPERTY(EditAnywhere, meta = (UIMin = "0", UIMax = "1000"))
int32 Score;

// Units：显示单位
UPROPERTY(EditAnywhere, meta = (Units = "cm/s"))
float MoveSpeed;
```

### UI相关

```cpp
// DisplayName：在编辑器中显示的中文名
UPROPERTY(EditAnywhere, meta = (DisplayName = "最大生命值"))
float MaxHealth;

// ToolTip：鼠标悬停提示
UPROPERTY(EditAnywhere, meta = (ToolTip = "角色的最大生命值，不可超过9999"))
float MaxHealth;

// EditCondition：根据其他属性的值决定是否可编辑
UPROPERTY(EditAnywhere)
bool bUseShield = false;

UPROPERTY(EditAnywhere, meta = (EditCondition = "bUseShield"))
//                                                 ─────┬─────
//                           只有当bUseShield=true时，这个属性才能编辑
float ShieldValue = 50.0f;

// InlineEditConditionToggle：把EditCondition的bool值变成复选框放在属性旁边
UPROPERTY(EditAnywhere, meta = (InlineEditConditionToggle))
bool bEnableAdvancedSettings;
```

### 数组相关

```cpp
// TitleProperty：数组每个元素的标题用哪个属性显示
UPROPERTY(EditAnywhere, meta = (TitleProperty = "WeaponName"))
TArray<UWeaponItem*> Weapons;  // 数组每个元素标题显示武器名而不是默认的索引号

// NoElementDuplicate：不允许数组中存在重复元素
UPROPERTY(EditAnywhere, meta = (NoElementDuplicate))
TArray<FName> UniqueTags;
```

---

## 完整使用示例

```cpp
UCLASS(Blueprintable)
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    // ===== 基础属性 =====
    // 角色名：可见但不可编辑（在BeginPlay中设置）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Character Info",
              meta = (DisplayName = "角色名称"))
    FString CharacterName;

    // 最大血量：可编辑默认值，有范围限制
    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Combat",
              meta = (ClampMin = "1", ClampMax = "9999", UIMin = "1", UIMax = "500"))
    float MaxHealth = 100.0f;

    // 当前血量：运行时可见，蓝图中可读（只有C++能修改）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Combat",
              meta = (DisplayName = "当前血量"))
    float CurrentHealth;

    // 移动速度：有单位，有滑条
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement",
              meta = (ClampMin = "0", ClampMax = "2000", UIMin = "0", UIMax = "1000",
                      Units = "单位/秒"))
    float MoveSpeed = 600.0f;

    // 是否有护盾：控制下面属性的可见性
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat",
              meta = (InlineEditConditionToggle))
    bool bHasShield = false;

    // 护盾值：只有勾选了bHasShield才能编辑
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat",
              meta = (EditCondition = "bHasShield", ClampMin = "0"))
    float ShieldValue = 0.0f;

    // 武器列表：每个元素标题显示武器名
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Inventory",
              meta = (TitleProperty = "WeaponName"))
    TArray<class UWeaponItem*> WeaponInventory;

    // ===== 组件 =====
    // 组件指针：可见但不可编辑（组件本身）
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    class USkeletalMeshComponent* CharacterMesh;

    // ===== 内部使用 =====
    // 不需要在编辑器中显示的运行时数据
    UPROPERTY(Transient)  // 不序列化
    float TimeSinceLastAttack;  // 纯C++内部使用，不暴露给蓝图
};
```

---

## UPROPERTY最佳实践

```cpp
// ✅ 好：分类清晰，参数合理
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat | Damage")
float BaseAttackDamage;

// ✅ 好：组件指针用 VisibleAnywhere
UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
class UCapsuleComponent* CapsuleComp;

// ❌ 差：Category用得太笼统
UPROPERTY(EditAnywhere, Category = "Settings")  // 什么设置？太难找了
float Value1;

// ✅ 好：Category有层级
UPROPERTY(EditAnywhere, Category = "Combat | Damage | Melee")  // | 创建子分类
float MeleeDamage;

// ❌ 差：该用EditDefaultsOnly的用了EditAnywhere
UPROPERTY(EditAnywhere)
float MaxHealth;  // 在关卡实例上改基础属性容易造成混乱

// ✅ 好：基础属性用EditDefaultsOnly
UPROPERTY(EditDefaultsOnly)
float MaxHealth;  // 统一在类默认值中修改
```

---

## 完成检查清单

- [ ] 能区分 EditAnywhere / EditDefaultsOnly / EditInstanceOnly
- [ ] 知道何时用 BlueprintReadOnly vs BlueprintReadWrite
- [ ] 理解 Transient 的作用（临时数据不保存）
- [ ] 会用 meta = (ClampMin, ClampMax, EditCondition, DisplayName)
- [ ] 知道组件指针应该用 VisibleAnywhere 而非 EditAnywhere
- [ ] 理解 UPROPERTY 对 GC 保护的关键作用
