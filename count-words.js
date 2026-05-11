const fs = require('fs');
const path = require('path');

// 统计函数
function countInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 总字符数（包含所有字符）
    const totalChars = content.length;

    // 去除空白后的字符数
    const charsNoWhitespace = content.replace(/\s/g, '').length;

    // 中文字符数（Unicode CJK范围）
    const chineseChars = (content.match(/[一-鿿　-〿＀-￯]/g) || []).length;

    // 英文单词数
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;

    return { totalChars, charsNoWhitespace, chineseChars, englishWords };
}

// 遍历目录
function getAllMdFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // 跳过 .git 和 node_modules
            if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.claude') continue;
            getAllMdFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }
    return files;
}

const rootDir = process.cwd();
const mdFiles = getAllMdFiles(rootDir).sort();

let total = { totalChars: 0, charsNoWhitespace: 0, chineseChars: 0, englishWords: 0 };

console.log('='.repeat(80));
console.log('项目字数统计');
console.log('='.repeat(80));
console.log();

for (const file of mdFiles) {
    const relativePath = path.relative(rootDir, file);
    const stats = countInFile(file);

    total.totalChars += stats.totalChars;
    total.charsNoWhitespace += stats.charsNoWhitespace;
    total.chineseChars += stats.chineseChars;
    total.englishWords += stats.englishWords;

    console.log(`${relativePath}`);
    console.log(`  总字符数: ${stats.totalChars.toLocaleString()}`);
    console.log(`  去空白:   ${stats.charsNoWhitespace.toLocaleString()}`);
    console.log(`  中文字符: ${stats.chineseChars.toLocaleString()}`);
    console.log(`  英文单词: ${stats.englishWords.toLocaleString()}`);
    console.log();
}

console.log('='.repeat(80));
console.log('总计');
console.log('='.repeat(80));
console.log(`Markdown 文件数: ${mdFiles.length}`);
console.log(`总字符数:        ${total.totalChars.toLocaleString()}`);
console.log(`去空白字符数:    ${total.charsNoWhitespace.toLocaleString()}`);
console.log(`中文字符数:      ${total.chineseChars.toLocaleString()}`);
console.log(`英文单词数:      ${total.englishWords.toLocaleString()}`);
console.log('='.repeat(80));
