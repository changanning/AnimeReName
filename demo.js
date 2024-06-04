// const fs = require("fs");
// const path = require("path");
// const axios = require("axios");
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// 生成目录树
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
// 文件重命名并移动
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
// const directoryPath = __dirname;
const directoryPath = "G:\\115 Downloads";
const resultsSync = getFilesAndFoldersSync(directoryPath);
// console.log(resultsSync);

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

// 文件夹名解析
async function fileNameJieXi(pathName) {
    // 获取文件夹名
    let fileName = path.basename(pathName);
    // []以及其中的内容
    let AnimeNameRegex = /\[.*?\]/g;
    let fileNameChaiJieArr = fileName.match(AnimeNameRegex) || [];
    // 获取剧名
    let tempStr = fileName.replace(/\[[^\]]*\]/g, "");
    fileNameChaiJieArr.unshift(tempStr.trim());
    // 季节初始标记
    let seasonNum = 1;
    // 集数标记
    let epsiodeCount = 25;
    let chinaName = "";
    let chinaSeasonName = "";
    // 检测当前为什么季节
    let getParams = {
        method: "GET",
        headers: {
            accept: "application/json",
            Authorization:
                "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmM3NjE3MGM0MzRjMDg1OTBjZmRiOWZhZDQ2NGFmMyIsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.40wlnzIDZdXUMyBbl2lonctJqDw62KhrfIGXP9XeziY",
        },
    };
    let AnimeSearchName = fileNameChaiJieArr[0];
    console.log("查询番剧名称", AnimeSearchName);
    if (new RegExp(/\b(S\d+|Season\s?\d+)\b/gi).test(fileNameChaiJieArr[0])) {
        // seasonNum = fileNameChaiJieArr[0].match(/\d+/g).join();
        // 去除名字中的季节
        AnimeSearchName = fileNameChaiJieArr[0]
            .replace(/\b(S\d+|Season\s?\d+)\b/gi, "")
            .trim();
    } else {
        // 请求 URL中需要将空格更改%20
        AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
    }

    // 查询TMDB的ID API
    let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${AnimeSearchName}&language=en-US&page=1`;
    let AnimeSearchID = await fetch(searchUrl, getParams)
        .then((res) => res.json())
        .then((json) => json.results[0].id)
        .catch((err) => console.log("请求错误", err));
    // TMDB作品标题 API
    let TMDBAlternativeTitlesUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}/alternative_titles`;
    // TMDB详情页 API
    let TMDBDetailsUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}?language=zh-CN'`;
    // 请求作品详情页，查询中文名称
    let AnimeDetails = await fetch(TMDBDetailsUrl, getParams)
        .then((res) => res.json())
        .then((json) => json)
        .catch((err) => console.log("请求错误", err));
    // let seasonNameR = await fetch(TMDBAlternativeTitlesUrl,getParams).then(res=>res.json()).then(json=>json)
    // 获取季数
    AnimeDetails.seasons.forEach((item) => {
        if (item.episode_count == epsiodeCount) {
            seasonNum = item.season_number;
            chinaName = AnimeDetails.name;
            if (item.season_number > 1) {
                chinaSeasonName = item.name;
            } else {
                chinaSeasonName = AnimeDetails.name;
            }
        }
    });
    console.log("查询番剧的TMDB的ID", AnimeSearchID);
    console.log("查询番剧的中文名称", chinaName);
    console.log("查询番剧的季节名称", chinaSeasonName);
    console.log("季数为：" + seasonNum, "总共：" + epsiodeCount + "集");
}

// 解析文件名
// fileNameJieXi(resultsSync[0].path);
fileNameJieXi("[VCB-Studio] BAKUMAN S3 [Ma10p_1080p]");

// // 拆解文件名
// const AnimeNameRegex = /\[.*?\]/g;
// // let tempFileName = path.basename(resultsSync[11].path);
// let tempFileName =
//     "[UHA-WINGS&VCB-Studio] EIGHTY SIX [02][Web Preview 21][Ma10p_1080p][x265_flac].mkv";
// let tempRegexArr = tempFileName.match(AnimeNameRegex) || [];
// let remainingText = tempFileName.split(AnimeNameRegex).join("");
// tempRegexArr.push(remainingText.trim());
// // 去除文件后缀名
// tempRegexArr[tempRegexArr.length - 1] = tempRegexArr[
//     tempRegexArr.length - 1
// ].slice(0, tempRegexArr[tempRegexArr.length - 1].lastIndexOf("."));
// console.log(tempRegexArr);

// 识别.5的集数
// const floatNameRegex = new RegExp(/\[[^\]]*\.5[^\]]*\]/);
// console.log(floatNameRegex.test(tempFileName));

// 识别字幕组
// const floatNameRegex = new RegExp(/VCB/);
// console.log(floatNameRegex.test(tempRegexArr[0]));
// console.log(tempRegexArr[0].slice(1, -1));
// if(new RegExp(/UHA-WINGS/).test(tempRegexArr[0])) console.log("悠哈璃羽")

// 识别集数
// let ee = 0;
// tempRegexArr.forEach((item, index) => {
//     if (new RegExp(/\[(0[0-9]|[1-9][0-9])\]/).test(item))
//         ee = item.slice(1, -1);
// });

// console.log(
//     `${
//         tempRegexArr[tempRegexArr.length - 1]
//     }S01E${ee} - ${tempRegexArr[0].slice(1, -1)}`
// );

// 如何识别是那个组的资源？jsum通过文件夹的最后一个[自壓(付相關專輯)]识别，其他字幕组通过文件名的第一个[]识别
// jsum识别

// 移动并重命名文件
// fileRename(resultsSync);
