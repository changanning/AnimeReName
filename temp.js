import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import inquirer from "inquirer";
// function getFilesAndFoldersSync(dir) {
//     let fileListArr = [];
//     // 获取当前路径的下所有文件夹以及文件
//     let list = fs.readdirSync(dir);
//     let i = 0;
//     // 遍历寻找
//     list.forEach((file) => {
//         //解析为绝对路径
//         file = path.resolve(dir, file);
//         //获取当前文件信息
//         let stat = fs.statSync(file);
//         //判断当前文件是否文件夹
//         if (stat && stat.isDirectory()) {
//             fileListArr.push({ type: "Folder", path: file, sonFolder: [] });
//             fileListArr[i].sonFolder = fileListArr[i].sonFolder.concat(
//                 getFilesAndFoldersSync(file)
//             );
//             i++;
//         } else {
//             fileListArr.push({ type: "file", path: file });
//             i++;
//         }
//     });
//     return fileListArr;
// }

// const directoryPath = "G:\\115 Downloads";
// const resultsSync = getFilesAndFoldersSync(directoryPath);

// console.log(path.basename(resultsSync[0].path));`

// 控制台输入测试
// const questions = [
//   {
//     type: "input",
//     name: "name",
//     message: "请输入文件路径",
//   },
// ];

// inquirer.prompt(questions).then((answers) => {
//   console.log(`Hi ${answers.name}!`);
// });

// 图片下载功能

async function downloadImageFn() {
  let tmdbImgPath = "";
  let imgDownload = await fetch(
    "https://image.tmdb.org/t/p/w600_and_h900_bestv2/myzr5h408vgDrmlRuclsSQkJ0of.jpg"
  );
  let imgPath = "G:\\115 Downloads\\folder.jpg";
  let writer = fsExtra.createWriteStream(imgPath);
  imgDownload.body.pipe(writer);
  return new Promise((res, rej) => {
    writer.on("finish", res);
    writer.on("error", rej);
  });
}
downloadImageFn();
