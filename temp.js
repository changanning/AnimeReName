import fs from "fs";
import path from "path";
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

const directoryPath = "G:\\115 Downloads";
const resultsSync = getFilesAndFoldersSync(directoryPath);

console.log(path.basename(resultsSync[0].path));