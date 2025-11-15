# SQLite并发控制说明

## 问题描述

原始的SQLite实现存在以下并发问题：

1. **无锁机制**: 多个操作同时访问数据库可能导致数据竞争
2. **回调地狱**: 使用callback而非Promise，难以管理异步操作
3. **无操作队列**: 并发写入可能导致SQLite锁定错误
4. **无事务控制**: 批量操作缺乏原子性保证

## 解决方案

### 1. 读写锁机制 (`ReadWriteLock`)

实现了一个简单的读写锁，支持：
- **读锁**: 允许多个并发读取
- **写锁**: 独占写入，写操作时会阻塞所有读写操作

```typescript
// 使用示例
const release = await lock.read(); // 获取读锁
try {
  // 执行读操作
} finally {
  release(); // 释放读锁
}
```

### 2. 操作队列 (`OperationQueue`)

串行化所有数据库操作，确保：
- 操作按顺序执行
- 避免并发写入冲突
- 自动错误处理

```typescript
// 使用示例
await queue.add(async () => {
  // 执行操作
});
```

### 3. WAL模式

启用SQLite的Write-Ahead Logging模式：
- 提高并发读写性能
- 减少锁竞争
- 支持更高效的读操作

```sql
PRAGMA journal_mode = WAL;
```

### 4. 事务控制

支持显式事务管理：
- 批量操作原子性保证
- 错误回滚机制
- BEGIN/COMMIT/ROLLBACK支持

```typescript
await dbHelper.beginTransaction();
try {
  // 执行多个操作
  await dbHelper.commit();
} catch (error) {
  await dbHelper.rollback();
  throw error;
}
```

### 5. 批量操作API

提供便捷的批量操作方法：

```typescript
// 批量执行操作
await dbHelper.batch([
  async () => { /* 操作1 */ },
  async () => { /* 操作2 */ },
  async () => { /* 操作3 */ }
]);
```

## 使用建议

### 对现有代码的影响

1. **SqliteUtilV2**: 新的并发安全版本，替代原有SqliteUtil
2. **向后兼容**: 保留原有StorageUtil接口，确保现有代码正常工作
3. **渐进式迁移**: 可以逐步迁移现有代码到新版本

### 最佳实践

1. **使用事务**: 对多个相关操作，使用事务确保原子性
2. **避免长事务**: 事务内避免耗时操作
3. **批量操作**: 对多个插入/更新，使用batch方法
4. **错误处理**: 总是捕获并处理数据库错误

### 性能优化

1. **WAL模式**: 启用预写日志提高并发性能
2. **索引**: 为常用查询字段添加索引
3. **连接池**: 避免频繁创建/销毁数据库连接
4. **Busy Timeout**: 设置合理的忙等待超时时间

## 测试并发安全

可以通过以下方式测试并发安全：

```typescript
// 并发读取测试
const readPromises = Array(100).fill(0).map(() =>
  dbHelper.get('SELECT * FROM post_info WHERE guid = ?', [guid])
);
await Promise.all(readPromises);

// 并发写入测试
const writePromises = Array(50).fill(0).map((_, i) =>
  dbHelper.run('INSERT INTO post_info ...', [`article_${i}`])
);
await Promise.all(writePromises);
```

## 监控和调试

1. **启用SQLite调试**: 在开发环境启用SQLite的调试输出
2. **监控锁等待**: 注意长时间锁等待可能表明性能问题
3. **性能分析**: 使用EXPLAIN QUERY PLAN分析查询性能

## 未来改进

1. **连接池**: 实现真正的连接池管理
2. **Prepared Statement**: 预编译语句提高性能
3. **触发器**: 使用数据库触发器自动维护数据一致性
4. **监听器**: 监听数据库变化通知应用层
