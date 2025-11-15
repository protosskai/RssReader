/**
 * 测试文章列表加载功能
 * 模拟点击RSS源时的完整流程
 */

const { net } = require('electron');

// RSS源ID（从之前的日志中获取）
const testRssSources = [
  'aa04a14e-470d-46e6-abd8-ebfd813e5343', // 美团技术团队
  'a5f76dc8-9962-48a6-83e9-422323f6b7ba', // 机核
  'f758a9db-b7a1-459b-91ea-6c9a3b746b9b', // 极客公园
  'f4e59dfb-f820-42dc-98f8-049e8d6fb1ea'  // 联合早报
];

const testRssUrl = async (url, name) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试RSS源: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const request = net.request({
      url: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const timeoutId = setTimeout(() => {
      console.error(`❌ 请求超时: ${name}`);
      request.abort();
      reject(new Error('请求超时'));
    }, 30000);

    request.on('response', (response) => {
      console.log(`📡 响应状态: ${response.statusCode}`);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        clearTimeout(timeoutId);
        console.error(`❌ HTTP错误: ${response.statusCode}`);
        reject(new Error(`HTTP错误: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (data) => {
        chunks.push(data);
      });

      response.on('end', () => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        try {
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const content = Buffer.concat(chunks).toString();

          console.log(`✅ 请求成功`);
          console.log(`⏱️  响应时间: ${duration}ms`);
          console.log(`📦 数据大小: ${totalLength} bytes`);
          console.log(`📄 内容长度: ${content.length} characters`);

          // 简单检查RSS内容
          const itemMatches = content.match(/<item>/gi);
          const articleCount = itemMatches ? itemMatches.length : 0;

          if (articleCount > 0) {
            console.log(`📰 文章数量: ${articleCount}`);
            console.log(`✅ ${name} - RSS内容验证通过`);
          } else {
            console.log(`⚠️  未找到文章条目，可能是RSS格式问题`);
          }

          resolve({
            success: true,
            duration,
            size: totalLength,
            articleCount
          });
        } catch (error) {
          console.error(`❌ 处理响应失败:`, error.message);
          reject(error);
        }
      });

      response.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`❌ 响应错误:`, error.message);
        reject(error);
      });

      response.on('aborted', () => {
        clearTimeout(timeoutId);
        console.error(`❌ 响应被中止`);
        reject(new Error('响应被中止'));
      });
    });

    request.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error(`❌ 请求错误:`, error.message);
      reject(error);
    });

    request.end();
  });
};

const runTests = async () => {
  console.log('\n🚀 开始测试RSS源可访问性\n');
  console.log('时间:', new Date().toISOString());
  console.log('测试数量:', testRssSources.length);

  const results = [];

  // 美团技术团队
  try {
    const result = await testRssUrl('https://tech.meituan.com/feed/', '美团技术团队');
    results.push({ name: '美团技术团队', ...result });
  } catch (error) {
    results.push({ name: '美团技术团队', success: false, error: error.message });
  }

  // 机核
  try {
    const result = await testRssUrl('https://www.gcores.com/rss', '机核');
    results.push({ name: '机核', ...result });
  } catch (error) {
    results.push({ name: '机核', success: false, error: error.message });
  }

  // 极客公园
  try {
    const result = await testRssUrl('https://www.geekpark.net/rss', '极客公园');
    results.push({ name: '极客公园', ...result });
  } catch (error) {
    results.push({ name: '极客公园', success: false, error: error.message });
  }

  // 联合早报
  try {
    const result = await testRssUrl('https://plink.anyfeeder.com/zaobao/realtime/world', '联合早报');
    results.push({ name: '联合早报', ...result });
  } catch (error) {
    results.push({ name: '联合早报', success: false, error: error.message });
  }

  // 汇总报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);

  console.log(`\n总计: ${totalCount} 个RSS源`);
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${totalCount - successCount} 个`);
  console.log(`📈 成功率: ${successRate}%`);

  if (successCount === totalCount) {
    console.log('\n🎉 所有RSS源均可正常访问！');
    console.log('💡 如果应用仍有问题，请检查数据库同步部分');
  } else {
    console.log('\n⚠️  部分RSS源无法访问，可能影响应用功能');
  }

  console.log('\n✅ 测试完成');
};

// 运行测试
runTests().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
