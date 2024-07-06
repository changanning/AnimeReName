import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import fetch from "node-fetch";
import inquirer from "inquirer";
import { execSync } from "child_process";
import FormData from "form-data";
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

// 控制台输入
// inquirer
//   .prompt({
//     type: "input",
//     name: "name",
//     message: "请输入：想要进行匹配的文件夹路径",
//   })
//   .then((answers) => {
//     console.log(`文件输入路径为：${path.resolve(answers.name)}`);
//   });
// inquirer
//   .prompt({
//     type: "input",
//     name: "name",
//     message: "请输入：匹配完成后的输出文件夹路径",
//   })
//   .then((answers) => {
//     console.log(`文件输出路径为：${path.resolve(answers.name)}`);
//   });

// 图片下载功能
// async function downloadImageFn() {
//   let tmdbImgPath = "";
//   let imgDownload = await fetch(
//     "https://image.tmdb.org/t/p/w600_and_h900_bestv2/myzr5h408vgDrmlRuclsSQkJ0of.jpg"
//   );
//   let imgPath = "G:\\115 Downloads\\folder.jpg";
//   let writer = fsExtra.createWriteStream(imgPath);
//   imgDownload.body.pipe(writer);
//   return new Promise((res, rej) => {
//     writer.on("finish", res);
//     writer.on("error", rej);
//   });
// }
// downloadImageFn();

// 文件复制
console.log(fs.existsSync(`Z:\\115\\影视资源`));
fs.copyFile(
  "G:\\Temp_Torrents\\[ANi] 尼爾：自動人形 Ver1.1a - 13 [1080P][Baha][WEB-DL][AAC AVC][CHT].mp4",
  "Z:\\115\\影视资源\\尼爾：自動人形 Ver1.1a - 13.mp4",
  function (err) {
    if (err) {
      console.log("复制失败");
      return;
    }
    console.log("复制成功");
  }
);
