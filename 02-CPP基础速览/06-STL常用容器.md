# 2.6 STL常用容器与UE等效类型

> **目标**：掌握C++标准库中最常用的容器类型，以及它们在UE中的对应物。游戏开发中99%的数据存储靠它们。

---

## 什么是容器？

**容器 = 能存多个数据的结构**。就像日常生活中的：

- **数组**（TArray）= 购物清单：有序列表，按顺序排列
- **字典**（TMap）= 通讯录：按名字查电话号码
- **集合**（TSet）= 一袋没有重复颜色的弹珠

---

## TArray — 动态数组（最常用的容器）

### 基础操作

```cpp
#include "Containers/Array.h"  // 通常CoreMinimal.h已包含

// ===== 创建 =====
TArray<int32> Numbers;                        // 空数组
TArray<int32> Numbers2 = {10, 20, 30, 40};   // 初始化列表
TArray<FString> Names;                        // 存字符串的数组
TArray<AActor*> Actors;                       // 存指针的数组

// ===== 添加 =====
Numbers.Add(10);                  // 加到末尾：[10]
Numbers.Add(20);                  // [10, 20]
Numbers.Add(30);                  // [10, 20, 30]
Numbers.Emplace(40);              // Emplace = 原地构造，比Add稍快：[10,20,30,40]

// ===== 插入 =====
Numbers.Insert(15, 1);            // 在索引1处插入15：[10,15,20,30,40]

// ===== 访问 =====
int32 First = Numbers[0];         // 用索引访问：10
int32 Last = Numbers.Last();      // 最后一个：40
int32 Top = Numbers.Top();        // 同Last()：40
bool bValid = Numbers.IsValidIndex(5);  // 检查索引5是否存在

// ===== 修改 =====
Numbers[0] = 999;                 // 直接赋值

// ===== 删除 =====
Numbers.Remove(30);               // 删除值为30的第一个元素
Numbers.RemoveAt(2);              // 删除索引2的元素
Numbers.RemoveAll([](int32 X) { return X < 20; });  // 删除所有<20的元素
Numbers.Pop();                    // 删除最后一个元素
Numbers.Empty();                  // 清空整个数组（保留已分配的内存）
Numbers.Reset();                  // 清空并释放内存

// ===== 查找 =====
int32 Index = Numbers.Find(20);           // 查找值20的索引，找不到返回INDEX_NONE(-1)
bool bContains = Numbers.Contains(30);    // 是否包含值30
```

### 遍历

```cpp
TArray<FString> Names = {TEXT("Alice"), TEXT("Bob"), TEXT("Charlie")};

// 方法1：范围for（最常用）
for (const FString& Name : Names)
{
    UE_LOG(LogTemp, Warning, TEXT("名字: %s"), *Name);
}

// 方法2：索引for（需要知道位置时）
for (int32 i = 0; i < Names.Num(); i++)
{
    UE_LOG(LogTemp, Warning, TEXT("#%d: %s"), i, *Names[i]);
}

// 方法3：倒序遍历（删除元素时用这个最安全）
for (int32 i = Names.Num() - 1; i >= 0; i--)
{
    if (Names[i].Contains(TEXT("A")))
    {
        Names.RemoveAt(i);  // 倒序删除不影响前面元素的索引
    }
}

// 方法4：RemoveAll（比手动遍历删除更优雅）
Names.RemoveAll([](const FString& Name)
{
    return Name.Contains(TEXT("A"));  // 删除所有包含"A"的名字
});
```

### 常用工具函数

```cpp
TArray<int32> Scores = {50, 30, 80, 20, 90};

Scores.Sort();                            // 升序排序：[20,30,50,80,90]
Scores.Sort([](int32 A, int32 B) { return A > B; });  // 降序排序：[90,80,50,30,20]

int32 MaxScore = FMath::Max(Scores);      // 错误！应该自己遍历或用Algo库
// 实际上TArray没有.Max()方法，需要自己实现或用Algo::Max(Scores)

Scores.Reserve(100);                      // 预分配100个位置（避免反复扩容）
int32 Num = Scores.Num();                 // 元素数量
Scores.SetNum(20);                        // 强制设为20个元素（多余的被删除）
bool bEmpty = Scores.Num() == 0;          // 判断是否为空

// 把数组内容复制到另一个数组
TArray<int32> Copy = Scores;              // 深拷贝（完全独立的副本）
```

---

## TMap — 字典/映射

### 基础操作

```cpp
// TMap<键类型, 值类型>
TMap<FString, int32> HealthMap;

// ===== 添加 =====
HealthMap.Add(TEXT("Player"), 100);
HealthMap.Add(TEXT("Enemy"), 50);
HealthMap.Add(TEXT("Boss"), 500);

// 或者用Emplace
HealthMap.Emplace(TEXT("NPC"), 30);

// ===== 访问 =====
int32 PlayerHP = HealthMap[TEXT("Player")];  // 用[]访问（键不存在时会自动创建！）

// 安全查找（推荐）
int32* FoundHP = HealthMap.Find(TEXT("Dragon"));  // 返回int32*指针
if (FoundHP != nullptr)
{
    UE_LOG(LogTemp, Warning, TEXT("龙的血量: %d"), *FoundHP);
}
else
{
    UE_LOG(LogTemp, Warning, TEXT("数据库中没有龙"));
}

// ===== 检查存在 =====
bool bHasPlayer = HealthMap.Contains(TEXT("Player"));

// ===== 修改 =====
HealthMap[TEXT("Player")] = 150;  // 更新值（如果键存在）

// ===== 删除 =====
HealthMap.Remove(TEXT("Enemy"));  // 删除键值对

// ===== 数量 =====
int32 NumEntries = HealthMap.Num();
```

### 遍历

```cpp
// 遍历所有键值对
for (auto& Pair : HealthMap)       // auto自动推断为TPair<FString, int32>&
{
    UE_LOG(LogTemp, Warning, TEXT("%s 的血量: %d"), *Pair.Key, Pair.Value);
}

// 只遍历键
TArray<FString> Keys;
HealthMap.GetKeys(Keys);

// 只遍历值
TArray<int32> Values;
HealthMap.GenerateValueArray(Values);
```

---

## TSet — 集合

**集合 = 没有重复元素、不保证顺序的容器。**

```cpp
TSet<FString> UniqueNames;

// ===== 添加（重复的不会重复添加）=====
UniqueNames.Add(TEXT("Alice"));   // 添加成功
UniqueNames.Add(TEXT("Bob"));     // 添加成功
UniqueNames.Add(TEXT("Alice"));   // 被忽略！Alice已经存在了

int32 Count = UniqueNames.Num();  // = 2，不是3

// ===== 检查存在 =====
bool bExists = UniqueNames.Contains(TEXT("Alice"));  // true

// ===== 删除 =====
UniqueNames.Remove(TEXT("Bob"));

// ===== 遍历 =====
for (const FString& Name : UniqueNames)
{
    // 顺序不保证和添加顺序一致
}

// ===== 使用场景：需要"不重复"的时候 =====
TSet<AActor*> AlreadyDamagedEnemies;  // 防止AOE伤害多次命中同一目标
void ApplyAOEDamage(FVector Center, float Radius)
{
    TArray<AActor*> HitActors;
    // ... 范围检测 ...

    for (AActor* Hit : HitActors)
    {
        if (!AlreadyDamagedEnemies.Contains(Hit))  // 还没对这个敌人造成伤害
        {
            ApplyDamage(Hit, 50.0f);
            AlreadyDamagedEnemies.Add(Hit);  // 标记已伤害
        }
    }
}
```

---

## 其他有用的UE容器

### TQueue — 队列（先进先出 FIFO）

```cpp
TQueue<FString> TaskQueue;

TaskQueue.Enqueue(TEXT("任务1"));   // 入队
TaskQueue.Enqueue(TEXT("任务2"));
TaskQueue.Enqueue(TEXT("任务3"));

FString CurrentTask;
while (TaskQueue.Dequeue(CurrentTask))  // 出队（按入队顺序）
{
    UE_LOG(LogTemp, Warning, TEXT("处理: %s"), *CurrentTask);
    // 输出：任务1, 任务2, 任务3（先进先出）
}
```

### TStack — 栈（先进后出 LIFO）

```cpp
// UE没有内置TStack，可以用TArray模拟
TArray<FString> Stack;
Stack.Push(TEXT("第1层"));   // 压栈
Stack.Push(TEXT("第2层"));
Stack.Push(TEXT("第3层"));

FString Top = Stack.Pop();   // 出栈 → "第3层"（最后进去的最先出来）
```

### TMap的多键查找

```cpp
// TMultiMap：允许一个键对应多个值
TMultiMap<FString, int32> InventoryMap;  // 一个物品类型可以有多件
InventoryMap.Add(TEXT("药水"), 5);
InventoryMap.Add(TEXT("药水"), 3);  // 不会覆盖，两个都保留（5和3）

// 查找某个键的所有值
TArray<int32> AllPotions;
InventoryMap.MultiFind(TEXT("药水"), AllPotions);  // [5, 3]
```

---

## 容器选择速查表

| 需求               | 用这个      | 为什么                 |
| ------------------ | ----------- | ---------------------- |
| 有序列表、需要索引 | `TArray`    | 最通用，[]访问O(1)     |
| 按键查找值         | `TMap`      | 查找O(1)，键是唯一ID   |
| 去重               | `TSet`      | 自动去重，查找O(1)     |
| 先进先出处理       | `TQueue`    | 任务队列、消息队列     |
| 一个键多个值       | `TMultiMap` | 一个技能对应多个效果等 |

---

## 性能提示

```cpp
// ✅ 好的做法
TArray<FVector> Positions;
Positions.Reserve(1000);  // 预分配：避免反复扩容（扩容会重新分配+拷贝所有数据）
for (int32 i = 0; i < 1000; i++)
{
    Positions.Add(FVector(i, 0, 0));
}

// ❌ 不好的做法
TArray<FVector> Positions;
for (int32 i = 0; i < 1000; i++)
{
    Positions.Add(FVector(i, 0, 0));  // 可能触发10+次内存重新分配
}

// ✅ 传引用遍历
for (const auto& Element : BigArray)  // const引用，不拷贝
{
    // ...
}

// ❌ 传值遍历
for (auto Element : BigArray)  // 每次循环都拷贝Element！
{
    // ...
}

// ✅ 倒序删除（索引不会乱）
for (int32 i = Array.Num() - 1; i >= 0; i--)
{
    if (ShouldRemove(Array[i]))
    {
        Array.RemoveAt(i);
    }
}
```

---

## 完成检查清单

- [ ] 能用 TArray 的 Add / Remove / [] / Num / Find
- [ ] 能用范围for遍历 TArray
- [ ] 理解倒序删除的原理
- [ ] 能用 TMap 的 Add / Find / [] / Contains / Remove
- [ ] 能用 TSet 做去重
- [ ] 能根据需求选择合适的容器
- [ ] 知道预分配（Reserve）和引用遍历的性能意义
