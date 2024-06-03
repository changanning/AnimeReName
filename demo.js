const fs = require("fs");
const path = require("path");

// 生成目录
function getFilesAndFoldersSync(dir) {
    let fileListArr = [];
    // 获取当前路径的下所有文件夹以及文件
    let list = fs.readdirSync(dir);
    let i = 0;
    // 遍历寻找
    list.forEach((file) => {
        //解析为绝对路径
        file = path.resolve(dir, file);
        //获取当前文件信息
        let stat = fs.statSync(file);
        //判断当前文件是否文件夹
        if (stat && stat.isDirectory()) {
            fileListArr.push({ type: "Folder", path: file, sonFolder: [] });
            fileListArr[i].sonFolder = fileListArr[i].sonFolder.concat(
                getFilesAndFoldersSync(file)
            );
            i++;
        } else {
            fileListArr.push({ type: "file", path: file });
            i++;
        }
    });
    return fileListArr;
}

function fileRename(arr) {
    arr.forEach((item, index) => {
        if (arr[index].type == "file") {
            // console.log(arr[index]);
            // 获取当前文件名字
            let fileName = path.basename(arr[index].path);
            // 获取当前文件后缀名字
            let fileExtname = path.extname(fileName);
            keyWords.forEach((i) => {
                if (
                    (MenuRegex.test(fileName) || menuRegex.test(fileName)) &&
                    (fileExtname == ".mkv" || fileExtname == ".MKV")
                ) {
                    fs.rename(
                        arr[index].path,
                        `${Extras}/${fileName}`,
                        (err) => {
                            console.log(arr[index].path, "移动失败：", err);
                        }
                    );
                }
                if (
                    (PVRegex.test(fileName) || promotionRegex.test(fileName)) &&
                    (fileExtname == ".mkv" || fileExtname == ".MKV")
                ) {
                    fs.rename(
                        arr[index].path,
                        `${Trailers}/${fileName}`,
                        (err) => {
                            console.log(arr[index].path, "移动失败：", err);
                        }
                    );
                }
                if (fileExtname == ".rar") {
                    fs.rename(arr[index].path, `${CDs}/${fileName}`, (err) => {
                        console.log(arr[index].path, "移动失败：", err);
                    });
                }
            });
        } else {
            // fileRename(arr[index])
        }
    });
}

// 生成目录
const directoryPath = __dirname;
const resultsSync = getFilesAndFoldersSync(directoryPath);

// console.log("Sync results:", resultsSync);

// fs.mkdir("./Interviews", function (err) {
//     if (err != null) console.log("Interviews创建失败", err);
// });
// fs.mkdir("./Trailers", function (err) {
//     if (err != null) console.log("Trailers创建失败", err);
// });
// fs.mkdir("./Extras", function (err) {
//     if (err != null) console.log("Extras创建失败", err);
// });
// fs.mkdir("./CDs", function (err) {
//     if (err != null) console.log("CDs创建失败", err);
// });
const Interviews = path.resolve("./Interviews");
const Trailers = path.resolve("./Trailers");
const Extras = path.resolve("./Extras");
const CDs = path.resolve("./CDs");
// 筛选关键词
let keyWords = [
    "Menu",
    "menu",
    "promotion",
    "PV",
    "characterPv",
    "ncop",
    "nced",
];
const MenuRegex = new RegExp("Menu");
const menuRegex = new RegExp("menu");
const PVRegex = new RegExp("PV");
const promotionRegex = new RegExp("promotion");

const AnimeNameRegex = /\[.*?\]/g;
let tempFileName = path.basename(resultsSync[11].path);
let tempRegexArr = tempFileName.match(AnimeNameRegex) || [];
let remainingText = tempFileName.split(AnimeNameRegex).join("");
tempRegexArr.push(remainingText.trim());
console.log(tempRegexArr);

// 移动并重命名文件
// fileRename(resultsSync);
