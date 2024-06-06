import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import fsExtra from "fs-extra";
// TMDB API访问令牌
const Authorization =
  "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmM3NjE3MGM0MzRjMDg1OTBjZmRiOWZhZDQ2NGFmMyIsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.40wlnzIDZdXUMyBbl2lonctJqDw62KhrfIGXP9XeziY";

// 生成目录树函数
function getDirectoryTreeFn(dirPath) {
  let fileListArr = [];
  // 获取当前路径的下所有文件夹以及文件
  let list = fs.readdirSync(dirPath);
  let i = 0;
  // 遍历寻找
  list.forEach((file) => {
    //解析为绝对路径
    file = path.resolve(dirPath, file);
    //获取当前文件信息
    let stat = fs.statSync(file);
    //判断当前文件是否文件夹
    if (stat && stat.isDirectory()) {
      fileListArr.push({ type: "Folder", path: file, sonFolder: [] });
      fileListArr[i].sonFolder = fileListArr[i].sonFolder.concat(
        getDirectoryTreeFn(file)
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
          fs.rename(arr[index].path, `${Extras}/${fileName}`, (err) => {
            console.log(arr[index].path, "移动失败：", err);
          });
        }
        if (
          (PVRegex.test(fileName) || promotionRegex.test(fileName)) &&
          (fileExtname == ".mkv" || fileExtname == ".MKV")
        ) {
          fs.rename(arr[index].path, `${Trailers}/${fileName}`, (err) => {
            console.log(arr[index].path, "移动失败：", err);
          });
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

function seekFolderFn(arrPramas) {
  // 解析第一层目录
  arrPramas.forEach(async (item) => {
    // 判断是否为非空文件夹
    if (item.type == "Folder" && item.sonFolder.length >= 1) {
      let subtitles = "VCB-Studio";
      // 对非空文件夹遍历
      for (let i = 0; i < item.sonFolder.length; i++) {
        // 判断是否为合集
        if (
          item.sonFolder[i].type == "Folder" &&
          /CDs|SPs|Scans/.test(path.basename(item.sonFolder[i].path))
        ) {
          // 匹配中文名称
          let fileNameJieXiCount = null;
          fileNameJieXiCount = await fileNameJieXi(
            item.path,
            VcbEpisodeFn(item)
          );
          // 分类重命名处理
          if (fileNameJieXiCount.chinaName != "") {
            await VcbFileReNameFn(fileNameJieXiCount, item.path, subtitles);
          }
          // VcbFileReNameFn({ chinaName: "爆漫王",seasonNum: 1,},item.path);
          break;
        }
        // 合集处理
        // if (
        //   item.sonFolder[i].type == "Folder" &&
        //   item.sonFolder[i].sonFolder.length >= 1
        // ) {
        //   seekFolderFn(item.sonFolder);
        // }
      }
    }
    // // 判断是否为jsum的压制
    // if (/自壓\(付相關專輯\)/g.test(path.basename(item.path))) {
    //     console.log("这是jsum的压制");
    // }
  });
}

// 文件分类处理
async function VcbFileReNameFn(vcbObj, vcbPath, subtitles) {
  let vcb = "vcb";
  // 获取原始文件夹
  let pathLabel = vcbPath.lastIndexOf("\\");
  let namePath = vcbPath.substring(0, pathLabel + 1);
  // console.log(vcbObj.chinaName);
  let tempName = vcbObj.chinaName;
  let newNamePath = namePath + tempName;
  // console.log(vcbPath, newNamePath);
  // 创建主文件夹
  if (!fs.existsSync(newNamePath)) {
    fs.mkdir(newNamePath, (err) => {});
  }
  // 下载infuse所需封面
  downloadImageFn(vcbObj.poster_path, newNamePath);

  // 文件分类
  // 获取新的目录树
  let fileTree = getDirectoryTreeFn(vcbPath);
  // console.log(fileTree);
  fileTree.forEach((item) => {
    // 文件夹创建
    folderFountFn(vcb, newNamePath, vcbObj.seasonNum);
    // 集数重命名
    if (item.type == "file") {
      if (
        /\[(0[0-9]|[1-9][0-9])\]/.test(path.basename(item.path)) &&
        path.extname(item.path) == ".mkv"
      ) {
        let episodeNum = path
          .basename(item.path)
          .match(/\[(0[0-9]|[1-9][0-9])\]/g)
          .join()
          .slice(1, 3);
        // console.log(vcbPath + "\\" + path.basename(item.path));
        fileReNameFn({
          oldFilePath: vcbPath + "\\" + path.basename(item.path),
          newFilePath: `${newNamePath}\\Season ${vcbObj.seasonNum}\\${vcbObj.chinaName} - S0${vcbObj.seasonNum}E${episodeNum} - ${subtitles}.mkv`,
        });
        // console.log(newNamePath);
      }
      // 识别集数为.5的
      // if(/\[[^\]]*\.5[^\]]*\]/.test(path.basename(item.path)))
    }
    // SPs 分类处理
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
      // console.log(item.path);

      item.sonFolder.forEach((twoItem) => {
        // console.log(twoItem.path);
        if (
          /Menu|menu/.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let newName = fileSPsReNameFn({
            keyWords: /Menu|menu/,
            seasonNum: vcbObj.seasonNum,
            chinaName: vcbObj.chinaName,
            path: twoItem.path,
          });
          fileReNameFn({
            oldFilePath: twoItem.path,
            newFilePath: `${newNamePath}\\Extras\\${newName}.mkv`,
          });
        }
        if (
          /promotion|PV|character Pv|CM|Preview/.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let newName = fileSPsReNameFn({
            keyWords: /promotion|PV|character Pv|CM|Preview/,
            seasonNum: vcbObj.seasonNum,
            chinaName: vcbObj.chinaName,
            path: twoItem.path,
          });
          fileReNameFn({
            oldFilePath: twoItem.path,
            newFilePath: `${newNamePath}\\Trailers\\${newName}.mkv`,
          });
        }
        if (
          /ncop|nced|NCED|NCOP/.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          // 从路径中获取当前文件名字
          let newName = fileSPsReNameFn({
            keyWords: /ncop|nced|NCED|NCOP/,
            seasonNum: vcbObj.seasonNum,
            chinaName: vcbObj.chinaName,
            path: twoItem.path,
          });
          //   console.log(vcbPath);
          fileReNameFn({
            oldFilePath: twoItem.path,
            newFilePath: `${newNamePath}\\Extras\\${newName}.mkv`,
          });
        }
        if (/IV/.test(twoItem.path) && path.extname(twoItem.path) == ".mkv") {
          // 从路径中获取当前文件名字
          let newName = fileSPsReNameFn({
            keyWords: /IV/,
            seasonNum: vcbObj.seasonNum,
            chinaName: vcbObj.chinaName,
            path: twoItem.path,
          });
          fileReNameFn({
            oldFilePath: twoItem.path,
            newFilePath: `${newNamePath}\\Interviews\\${newName}.mkv`,
          });
        }
      });
    }
    if (item.type == "Folder" && /CDs/.test(item.path)) {
      fileReNameFn({
        oldFilePath: item.path,
        newFilePath: `${newNamePath}\\CDs\\Season ${vcbObj.seasonNum}\\CDs`,
      });
      // fileReNameFn({
      //   oldFilePath: item.path,
      //   newFilePath: `${newNamePath}\\Season ${vcbObj.seasonNum}\\CDs`,
      // });
    }
  });
}
// 创建分类季节文件夹
function folderFountFn(vcb = "", pathName, seasonNum) {
  if (!fs.existsSync(`${pathName}\\Season ${seasonNum}`)) {
    fs.mkdir(`${pathName}\\Season ${seasonNum}`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\Interviews`)) {
    fs.mkdir(`${pathName}\\Interviews`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\Trailers`)) {
    fs.mkdir(`${pathName}\\Trailers`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\Extras`)) {
    fs.mkdir(`${pathName}\\Extras`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\CDs`)) {
    fs.mkdir(`${pathName}\\CDs`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\CDs\\Season ${seasonNum}`)) {
    fs.mkdir(`${pathName}\\CDs\\Season ${seasonNum}`, (err) => {});
  }
}

// 集数识别
function VcbEpisodeFn(VcbEObj) {
  let num = 0;
  VcbEObj.sonFolder.forEach((item) => {
    if (item.type == "file" && path.extname(item.path) == ".mkv") {
      num += 1;
    }
  });
  return num;
}

// 集数重命名
function fileReNameFn(obj) {
  //   let newPathName = `${obj.path}\\Season${obj.seasonNum}\\${obj.chinaName} - S0${obj.seasonNum}E${obj.episodeNum} - ${obj.subtitles} ".mkv"`;
  fs.rename(obj.oldFilePath, obj.newFilePath, (err) => {
    if (err != null) console.log(obj.oldFilePath, "ReName失败：", err);
  });
}

// 特典名读取
function fileSPsReNameFn(spsObj) {
  let newName = "";
  let fileName = path.basename(spsObj.path);
  // 拆解文件名
  let chaiJieArr = fileName.match(/\[.*?\]/g) || [];
  for (let i = 0; i < chaiJieArr.length; i++) {
    if (spsObj.keyWords.test(chaiJieArr[i])) {
      newName = `${spsObj.chinaName} Season 0${spsObj.seasonNum} ${chaiJieArr[
        i
      ].substring(1, chaiJieArr[i].length - 1)}`;
      //   console.log(newName);
    }
  }
  return newName;
}

// 文件夹名解析
async function fileNameJieXi(pathName, EpisodeCount) {
  // 获取文件夹名
  let fileName = path.basename(pathName);
  // 解析获取[]以及其中的内容
  let fileNameChaiJieArr = fileName.match(/\[.*?\]/g) || [];
  // 获取剧名
  let tempStr = fileName.replace(/\[[^\]]*\]/g, "");
  fileNameChaiJieArr.unshift(tempStr.trim());
  // 季节初始标记
  let seasonNum = 1;
  // 集数
  let episodeCount = EpisodeCount;
  // 中文名
  let chinaName = "";
  // 中文季名
  let chinaSeasonName = "";
  // 季数标记
  let seasonNumBJ = 1;
  let getParams = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization,
    },
  };

  let AnimeSearchName = fileNameChaiJieArr[0];
  // let animeErrName = AnimeSearchName;
  console.log("查询番剧名称", AnimeSearchName);
  // 解析并处理季数
  if (
    new RegExp(/\b(S\d+|Season\s?\d+)\b/gi).test(fileNameChaiJieArr[0]) ||
    new RegExp(/\b(10|[1-9])\b/g).test(fileNameChaiJieArr[0])
  ) {
    if (new RegExp(/\b(10|[1-9])\b/g).test(fileNameChaiJieArr[0])) {
      seasonNumBJ = (seasonNumBJ.match(/\d+/) || []).join("");
    }
    if (new RegExp(/\b(S\d+|Season\s?\d+)\b/gi).test(fileNameChaiJieArr[0])) {
      // 获取文件的季节数
      seasonNumBJ = AnimeSearchName.match(/\b(S\d+|Season\s?\d+)\b/g).join("");
      seasonNumBJ = (seasonNumBJ.match(/\d+/) || []).join("");
      // 去除名字中的季节
      AnimeSearchName = fileNameChaiJieArr[0]
        .replace(/\b(S\d+|Season\s?\d+)\b/gi, "")
        .trim();
      AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
    }
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
  // console.log(AnimeDetails.name);
  AnimeDetails.seasons.forEach((item) => {
    if (item.episode_count == episodeCount) {
      chinaName = AnimeDetails.name;
      if (item.season_number <= 1 && seasonNumBJ == 1) {
        chinaSeasonName = item.name;
        seasonNum = item.season_number;
      }
      if (item.season_number == seasonNumBJ) {
        chinaSeasonName = item.name;
        seasonNum = item.season_number;
      }
    } else {
      if (item.name != "特别篇")
        console.log(
          `当前集数错误，请检查集数。本地集数：${episodeCount},查询结果集数：${AnimeDetails.seasons[seasonNumBJ].episode_count}。匹配中文名称：${AnimeDetails.name}。当前识别为：第${seasonNumBJ}季`
        );
    }
  });
  console.log("匹配结果");
  console.log("TMDB_ID：" + AnimeSearchID);
  console.log("中文名称：" + chinaName);
  console.log("中文季节名称：" + chinaSeasonName);
  console.log("本季季数为：" + seasonNum, "本季集数：" + episodeCount);
  return {
    AnimeDetails,
    AnimeSearchID,
    chinaName,
    seasonNum,
    poster_path: AnimeDetails.poster_path,
  };
}

// 图片下载
async function downloadImageFn(tmdbImagePath, imageStoragePath) {
  let tmdbImgDownPath = `https://image.tmdb.org/t/p/w600_and_h900_bestv2/${tmdbImagePath}`;
  let imgDownload = await fetch(tmdbImgDownPath);
  let imgPath = `${imageStoragePath}\\folder.jpg`;
  let writer = fsExtra.createWriteStream(imgPath);
  imgDownload.body.pipe(writer);
  return new Promise((res, rej) => {
    writer.on("finish", res);
    writer.on("error", rej);
  });
}
// downloadImageFn();

// 生成目录树
// const directoryPath = __dirname;
const directoryPath = "G:\\115 Downloads";
let directoryTreeArr = getDirectoryTreeFn(directoryPath);

// 合集识别
seekFolderFn(directoryTreeArr);

// Specials 筛选关键词
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

// 识别.5的集数
// const floatNameRegex = new RegExp(/\[[^\]]*\.5[^\]]*\]/);
// console.log(floatNameRegex.test(tempFileName));

// 识别字幕组
// const floatNameRegex = new RegExp(/VCB/);
// if(new RegExp(/UHA-WINGS/).test(tempRegexArr[0])) console.log("悠哈璃羽")

// 如何识别是那个组的资源？jsum通过文件夹的最后一个[自壓(付相關專輯)]识别，其他字幕组通过文件名的第一个[]识别
// jsum识别

// 移动并重命名文件
// fileRename(resultsSync);
