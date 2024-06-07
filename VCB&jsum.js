import fs from "fs";
import path, { extname } from "path";
import fetch from "node-fetch";
import fsExtra from "fs-extra";
// TMDB API访问令牌
const Authorization =
  "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmM3NjE3MGM0MzRjMDg1OTBjZmRiOWZhZDQ2NGFmMyIsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.40wlnzIDZdXUMyBbl2lonctJqDw62KhrfIGXP9XeziY";
// 指定位置
const directoryPath = "G:\\115 Downloads";
// 指定生成位置
const new_dir_Path = "G:\\115_Downloads\\";
// 特典关键词
const SpKeyWords = {
  Trailers: /promotion|PV|character Pv|CM|Preview|Trailer|Teaser/,
  Others: /ncop|nced|NCED|NCOP|OP|ED|Menu|menu|MV|Easter Egg/,
  Interviews: /IV|Making/,
};
const SubKeyWords = {
  sub: /VCB-Studio|VCB-S|jsum/,
  video_params: /1080p|x264|x265|HEVC|AVC|H264|H265|Hi10p|BDrip|SP/i,
};
const YearReg = /\b\d{4}\b/g;

function getDirectoryTreeFn(dirPath) {
  let fileListArr = [];
  let list = fs.readdirSync(dirPath);
  let i = 0;
  list.forEach((file) => {
    file = path.resolve(dirPath, file);
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

// 识别
function seekFolderFn(arrPramas) {
  arrPramas.forEach(async (item, index) => {
    if (item.type == "Folder" && item.sonFolder.length >= 1) {
      // 字幕组识别
      let subtitles = seekSubtitlesFn(item.path);
      // let subtitles = item.path.match(/\[([^\]]+)\]/);
      // subtitles = subtitles ? subtitles[1] : null;
      let mkv_num = 0;
      let tv_num = 0;

      // 判断类别
      for (let i = 0; i < item.sonFolder.length; i++) {
        if (
          item.sonFolder[i].type == "file" &&
          path.extname(item.sonFolder[i].path) == ".mkv"
        ) {
          mkv_num++;
        }
        if (
          item.sonFolder[i].type == "Folder" &&
          /CDs|SPs|Scans/.test(path.basename(item.sonFolder[i].path))
        ) {
          tv_num++;
        }
        if (tv_num > 1 && mkv_num > 3) {
          item.category = "TV";
        }
        if (
          mkv_num < 2 ||
          /Movie|movie/.test(path.basename(item.sonFolder[i].path))
        ) {
          item.category = "Movie";
        }
      }
      let category = item.category ? item.category : "Movie";
      if (category == "TV") {
        let tv_resolve = null;
        tv_resolve = await fileNameJieXi(
          item.path,
          tvEpisodeFn(item),
          category
        );
        if (tv_resolve.chinaName != "") {
          await tvSortTidyFn(tv_resolve, item.path, subtitles);
        }
      }
      if (category == "Movie") {
        let movie_name = await tmdbRequest(subtitles);
        // let movie_name = await fileNameJieXi(item.path, 1, "Movie");
        if (movie_name.chinaName != "") {
          await movieSortTidyFn(movie_name, item.path, subtitles);
        }
      }
    }
  });
}

// subtitles识别
function seekSubtitlesFn(sub_path) {
  let prototype_name = null;
  let name = null;
  let season_num = 1;
  let subtitles = null;
  let seek_category_keyword = null;

  // 判断是否被[]全包裹
  if (path.basename(sub_path).replace(/\[([^\]]+)\]/g, "") == "") {
    sub_path.match(/\[.*?\]/g).forEach((item, index) => {
      if (/movie/i.test(item)) {
        seek_category_keyword = "movie";
      } else {
        if (seek_category_keyword === null) seek_category_keyword = "TV";
      }
      // 提取剧名
      if (!(SubKeyWords.video_params.test(item) && index != 0)) {
        prototype_name = item.slice(1, -1);
        name = item.slice(1, -1);
        if (/\b(10|[1-9])\b/g.test(item) && seek_category_keyword == "TV") {
          console.log(item);
          prototype_name = item;
          name = item.repeat(/\b(10|[1-9])\b/g, "").trim();
          season_num = item.match(/\b(10|[1-9])\b/g).join("");
        }
        if (
          /\b(S\d+|Season\s?\d+)\b/gi.test(item) &&
          seek_category_keyword == "TV"
        ) {
          // console.log(item);
          prototype_name = item;
          name = item.repeat(/\b(S\d+|Season\s?\d+)\b/gi, "").trim();
          season_num = item.match(/\d+/).join("");
        }
      }
      //
      if (SubKeyWords.sub.test(item) && index == 0) {
        subtitles = item.match(SubKeyWords.sub).join("");
      }
      // 识别jsum
      if (YearReg.test(item) && index == 0 && subtitles === null)
        subtitles = "jsum";
      if (/AI-Raws/i.test(item) && subtitles === null) {
        subtitles = "AI-Raws";
      }
    });
  } else {
    let m = 0;
    getDirectoryTreeFn(sub_path).forEach((item) => {
      if (item.type == "file" && path.extname(item.path) == ".mkv") m++;
    });
    name = path.basename(sub_path).replace(/\[([^\]]+)\]/g, "");
    prototype_name = name;
    let pathNameCJ = path.basename(sub_path).match(/\[.*?\]/g) || [];
    pathNameCJ.push(name);
    if (SubKeyWords.sub.test(pathNameCJ[0])) {
      subtitles = pathNameCJ[0].match(SubKeyWords.sub).join("");
    }
    pathNameCJ.forEach((item, index) => {
      // console.log(`m=${m},${seek_category_keyword}`);
      if (/movie/i.test(item) || m < 2) {
        seek_category_keyword = "movie";
      } else {
        if (seek_category_keyword === null) seek_category_keyword = "TV";
      }
      if (/\b(10|[1-9])\b/g.test(item) && seek_category_keyword == "TV") {
        console.log(item);
        prototype_name = item;
        name = item.repeat(/\b(10|[1-9])\b/g, "").trim();
        season_num = item.match(/\b(10|[1-9])\b/g).join("");
      }
      if (
        /\b(S\d+|Season\s?\d+)\b/gi.test(item) &&
        seek_category_keyword == "TV"
      ) {
        console.log(item);
        prototype_name = item;
        name = item.repeat(/\b(S\d+|Season\s?\d+)\b/gi, "").trim();
        season_num = item.match(/\d+/).join("");
      }
    });
  }
  // console.log(
  //   `字幕组：${subtitles} 提取名字：${name} 识别类型：${seek_category_keyword} 季节：${season_num} 原名：${prototype_name}\r\n \r\n`
  // );
  return {
    subtitles,
    name,
    seek_category_keyword,
    prototype_name,
  };
}

// TV分类整理移动
async function tvSortTidyFn(tvObj, tvPath, subtitles) {
  let pathLabel = tvPath.lastIndexOf("\\");
  let namePath = new_dir_Path;
  let tempName = tvObj.chinaName;
  let newNamePath = namePath + tempName;
  if (!fs.existsSync(newNamePath)) {
    fs.mkdir(newNamePath, (err) => {});
  }

  // 下载infuse所需封面
  downloadImageFn(tvObj.poster_path, newNamePath);

  // 获取新的目录树
  let fileTree = getDirectoryTreeFn(tvPath);
  fileTree.forEach((item) => {
    // 文件夹创建
    folderFountFn("TV", newNamePath, tvObj.seasonNum);
    // 集数重命名
    if (item.type == "file") {
      if (
        /\[(0[0-9]|[1-9][0-9])\]/.test(path.basename(item.path)) &&
        (path.extname(item.path) == ".mkv" || path.extname(item.path) == ".ass")
      ) {
        let houZhui = null;
        if (path.extname(item.path) == ".mkv") {
          houZhui = ".mkv";
        }
        if (path.extname(item.path) == ".ass") {
          if (/sc|SC|chs|CHS/.test(path.basename(item.path))) {
            houZhui = ".chs.ass";
          }
          if (/tc|TC|cht|CHT/.test(path.basename(item.path))) {
            houZhui = ".cht.ass";
          }
        }
        let episodeNum = path
          .basename(item.path)
          .match(/\[(0[0-9]|[1-9][0-9])\]/g)
          .join()
          .slice(1, 3);
        tvReNameFn(
          tvPath + "\\" + path.basename(item.path),
          `${newNamePath}\\Season ${tvObj.seasonNum}\\${tvObj.chinaName} - S0${tvObj.seasonNum}E${episodeNum} - ${subtitles}${houZhui}`
        );
      }
      // 识别集数为.5的
      // if(/\[[^\]]*\.5[^\]]*\]/.test(path.basename(item.path)))
    }
    // SPs 分类处理
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
      item.sonFolder.forEach((twoItem) => {
        if (
          SpKeyWords.Others.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let newName = fileSPsReNameFn({
            keyWords: SpKeyWords.Others,
            seasonNum: tvObj.seasonNum,
            chinaName: tvObj.chinaName,
            path: twoItem.path,
          });
          tvReNameFn(twoItem.path, `${newNamePath}\\Others\\${newName}.mkv`);
        }
        if (
          SpKeyWords.Trailers.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let newName = fileSPsReNameFn({
            keyWords: SpKeyWords.Trailers,
            seasonNum: tvObj.seasonNum,
            chinaName: tvObj.chinaName,
            path: twoItem.path,
          });
          tvReNameFn(twoItem.path, `${newNamePath}\\Trailers\\${newName}.mkv`);
        }
        // if (
        //   /ncop|nced|NCED|NCOP|OP|ED/.test(twoItem.path) &&
        //   path.extname(twoItem.path) == ".mkv"
        // ) {
        //   let newName = fileSPsReNameFn({
        //     keyWords: /ncop|nced|NCED|NCOP|OP|ED/,
        //     seasonNum: tvObj.seasonNum,
        //     chinaName: tvObj.chinaName,
        //     path: twoItem.path,
        //   });
        //   tvReNameFn(twoItem.path, `${newNamePath}\\Others\\${newName}.mkv`);
        // }
        if (
          SpKeyWords.Interviews.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let newName = fileSPsReNameFn({
            keyWords: SpKeyWords.Interviews,
            seasonNum: tvObj.seasonNum,
            chinaName: tvObj.chinaName,
            path: twoItem.path,
          });
          tvReNameFn(
            twoItem.path,
            `${newNamePath}\\Interviews\\${newName}.mkv`
          );
        }
      });
    }
    if (item.type == "Folder" && /CDs/.test(item.path)) {
      tvReNameFn(
        item.path,
        `${newNamePath}\\CDs\\Season ${tvObj.seasonNum}\\CDs`
      );
    }
  });
}

// 电影分类整理移动
async function movieSortTidyFn(movieObj, old_path, subtitles) {
  // 原文件夹
  let movieReName_old_path = old_path || null;
  // 存放目录
  let movieReName_new_path = null;
  // 新路径
  movieReName_new_path = new_dir_Path + movieObj.chinaName;
  let movie_new_name = movieObj.chinaName;
  // console.log(`movie_new_name: ${movie_new_name}`);
  // 判断新路径是否存在
  if (!fs.existsSync(movieReName_new_path)) {
    fs.mkdir(movieReName_new_path, (err) => {
      // console.log(movieReName_new_path + ":创建失败", err);
    });
  }
  // // infuse封面
  // downloadImageFn(movieObj.poster_path, movieReName_new_path);
  let fileTree = getDirectoryTreeFn(old_path);
  let resolution = null;
  let hdr = null;
  let DoVi = null;
  fileTree.forEach((item) => {
    // 分类文件夹创建
    folderFountFn("movie", movieReName_new_path, 1);
    // 电影重命名及版本区分
    if (
      item.type == "file" &&
      /1080p|1080P/.test(path.basename(item.path)) &&
      (path.extname(item.path) == ".mkv" || path.extname(item.path) == ".ass")
    ) {
      resolution = "1080p";
      if (path.extname(item.path) == ".mkv") {
        let movie_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /sc|SC|chs|CHS/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.chs.ass`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.cht.ass`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
    }
    if (
      item.type == "file" &&
      /2160p|2160P/.test(path.basename(item.path)) &&
      (path.extname(item.path) == ".mkv" || path.extname(item.path) == ".ass")
    ) {
      resolution = "2160p";
      if (path.extname(item.path) == ".mkv") {
        let movie_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /sc|SC|chs|CHS/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.chs.mkv`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution} - ${subtitles}.cht.mkv`;
        movieReNameFn(item.path, movie_sub_new_path);
      }

      if (
        /HDR/.test(path.basename(item.path)) &&
        path.extname(item.path) == ".mkv"
      ) {
        hdr = "HDR";
        let movie_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution}.${hdr} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }

      if (
        /DV|DoVi/.test(path.basename(item.path)) &&
        path.extname(item.path) == ".mkv"
      ) {
        DoVi = "DoVi";
        let movie_new_path = `${movieReName_new_path}\\${movie_new_name} - ${resolution}.${DoVi} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
    }

    // 特典分类整理
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
      item.sonFolder.forEach((twoItem) => {
        if (
          SpKeyWords.Others.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${movieReName_new_path}\\Others\\${movie_new_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Others
          )} - ${subtitles}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Trailers.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${movieReName_new_path}\\Trailers\\${movie_new_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Trailers
          )} - ${subtitles}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Interviews.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${movieReName_new_path}\\Interviews\\${movie_new_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Interviews
          )} - ${subtitles}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
      });
    }
    // CD处理
    if (item.type == "Folder" && /CDs/.test(item.path)) {
      movieReNameFn(item.path, `${movieReName_new_path}\\CDs\\CDs`);
    }
  });
}

// 创建分类文件夹
function folderFountFn(keyWords, pathName, seasonNum) {
  if (keyWords != "movie") {
    if (!fs.existsSync(`${pathName}\\Season ${seasonNum}`)) {
      fs.mkdir(`${pathName}\\Season ${seasonNum}`, (err) => {});
    }
    if (!fs.existsSync(`${pathName}\\CDs\\Season ${seasonNum}`)) {
      fs.mkdir(`${pathName}\\CDs\\Season ${seasonNum}`, (err) => {});
    }
  } else {
    if (!fs.existsSync(`${pathName}\\CDs`)) {
      fs.mkdir(`${pathName}\\CDs`, (err) => {});
    }
  }

  if (!fs.existsSync(`${pathName}\\Interviews`)) {
    fs.mkdir(`${pathName}\\Interviews`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\Trailers`)) {
    fs.mkdir(`${pathName}\\Trailers`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\Others`)) {
    fs.mkdir(`${pathName}\\Others`, (err) => {});
  }
  if (!fs.existsSync(`${pathName}\\CDs`)) {
    fs.mkdir(`${pathName}\\CDs`, (err) => {});
  }
}

// 集数识别
function tvEpisodeFn(VcbEObj) {
  let num = 0;
  VcbEObj.sonFolder.forEach((item) => {
    if (item.type == "file" && path.extname(item.path) == ".mkv") {
      num += 1;
    }
  });
  return num;
}

// TV集数重命名
function tvReNameFn(oldPath, newPath) {
  fs.rename(oldPath, newPath, (err) => {
    if (err != null) console.log(oldPath, "TV重命名失败：", err);
  });
}

// 电影重命名
function movieReNameFn(old_path, new_path) {
  fs.rename(old_path, new_path, (err) => {
    if (err != null) console.log(old_path, "电影ReName失败：", err);
  });
}

// 电影特典名读取
function movieSpNameFn(path_name, keyWords) {
  let sp_name = path.basename(path_name);
  sp_name = sp_name.match(/\[.*?\]/g) || [];
  for (let i = 0; i < sp_name.length; i++) {
    if (keyWords.test(sp_name[i])) {
      return `${sp_name[i].slice(1, sp_name[i].length - 1)}`;
    }
  }
}

// TV特典名读取
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

// TMDB请求
// async function fileNameJieXi(pathName, EpisodeCount, category) {
//   // 获取文件夹名
//   let fileName = path.basename(pathName);
//   // 解析获取[]以及其中的内容
//   let fileNameChaiJieArr = fileName.match(/\[.*?\]/g) || [];
//   // 获取剧名
//   let tempStr = fileName.replace(/\[[^\]]*\]/g, "");
//   fileNameChaiJieArr.unshift(tempStr.trim());
//   // 季节初始标记
//   let seasonNum = 1;
//   // 集数
//   let episodeCount = EpisodeCount;
//   // 中文名
//   let chinaName = "";
//   // 中文季名
//   let chinaSeasonName = "";
//   // 季数初始标记
//   let seasonNumBJ = 1;
//   let anime = null;
//   let getParams = {
//     method: "GET",
//     headers: {
//       accept: "application/json",
//       Authorization: Authorization,
//     },
//   };
//   // TV识别
//   if (category == "TV") {
//     let AnimeSearchName = fileNameChaiJieArr[0];
//     let animeErrName = AnimeSearchName;
//     if (/\b(10|[1-9])\b/g.test(fileNameChaiJieArr[0])) {
//       seasonNumBJ = (AnimeSearchName.match(/\b(10|[1-9])\b/g) || []).join("");
//       AnimeSearchName = fileNameChaiJieArr[0]
//         .replace(/\b(10|[1-9])\b/g, "")
//         .trim();
//       AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
//     }
//     if (/\b(S\d+|Season\s?\d+)\b/gi.test(fileNameChaiJieArr[0])) {
//       seasonNumBJ = AnimeSearchName.match(/\b(S\d+|Season\s?\d+)\b/g).join("");
//       seasonNumBJ = (seasonNumBJ.match(/\d+/) || []).join("");
//       AnimeSearchName = fileNameChaiJieArr[0]
//         .replace(/\b(S\d+|Season\s?\d+)\b/gi, "")
//         .trim();
//       AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
//     } else {
//       AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
//     }

//     // 查询TMDB的ID API
//     let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${AnimeSearchName}&language=en-US&page=1`;
//     let AnimeSearchID = await fetch(searchUrl, getParams)
//       .then((res) => res.json())
//       .then((json) => json.results[0].id)
//       .catch((err) => console.log("番剧ID请求错误", err));
//     let TMDBAlternativeTitlesUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}/alternative_titles`;
//     let TMDBDetailsUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}?language=zh-CN'`;
//     let AnimeDetails = await fetch(TMDBDetailsUrl, getParams)
//       .then((res) => res.json())
//       .then((json) => json)
//       .catch((err) => console.log("番剧详情请求错误", err));
//     // 获取季数
//     AnimeDetails.seasons.forEach((item) => {
//       // 集数识别
//       if (item.episode_count == episodeCount) {
//         chinaName = AnimeDetails.name;
//         if (item.season_number <= 1 && seasonNumBJ == 1) {
//           chinaSeasonName = item.name;
//           seasonNum = item.season_number;
//         }
//         if (item.season_number == seasonNumBJ) {
//           chinaSeasonName = item.name;
//           seasonNum = item.season_number;
//         }
//       } else {
//         if (item.name != "特别篇")
//           console.log(
//             `${animeErrName}集数错误，请检查集数。本地集数：${episodeCount},查询结果集数：${AnimeDetails.seasons[seasonNumBJ].episode_count}。匹配中文名称：${AnimeDetails.name}。当前识别为：第${seasonNumBJ}季`
//           );
//       }
//     });
//     anime = {
//       AnimeDetails,
//       AnimeSearchID,
//       chinaName,
//       seasonNum,
//       poster_path: AnimeDetails.poster_path,
//     };
//     console.log("查询番剧名称", animeErrName);
//     console.log("匹配结果");
//     console.log("TMDB_ID：" + AnimeSearchID);
//     console.log("中文名称：" + chinaName);
//     console.log("中文季节名称：" + chinaSeasonName);
//     console.log("本季季数为：" + seasonNum, "本季集数：" + episodeCount);
//   }
//   if (category == "Movie") {
//     let anime_movie_name = fileNameChaiJieArr[0];
//     let temp_name = anime_movie_name;
//     anime_movie_name = anime_movie_name.replace(/ /g, "%20");
//     let tmdb_movie_search_api = `https://api.themoviedb.org/3/search/movie?query=${anime_movie_name}&include_adult=true&language=en-US&page=1`;
//     let movie_search_id = await fetch(tmdb_movie_search_api, getParams)
//       .then((res) => res.json())
//       .then((json) => json.results[0].id)
//       .catch((err) => console.log("电影ID请求错误", err));
//     let tmdb_movie_details_api = `https://api.themoviedb.org/3/movie/${movie_search_id}?language=zh-CN`;
//     let movie_details = await fetch(tmdb_movie_details_api, getParams)
//       .then((res) => res.json())
//       .then((json) => json)
//       .catch((err) => console.log("电影详情请求错误", err));
//     anime = {
//       movie_details,
//       movie_search_id,
//       chinaName: movie_details.title,
//       poster_path: movie_details.poster_path,
//     };
//     console.log("查询电影/剧场版名称", temp_name);
//     console.log("匹配结果");
//     console.log("TMDB_ID：" + movie_search_id);
//     console.log("中文名称：" + movie_details.title);
//   }
//   return anime;
// }
async function tmdbRequest(tmdb_Obj) {
  // 类型
  let category = tmdb_Obj.seek_category_keyword;
  // 集数
  let episodeCount = EpisodeCount;
  // 中文名
  let chinaName = "";
  // 中文季名
  let chinaSeasonName = "";
  // 季数初始标记
  let seasonNumBJ = 1;
  let anime = null;
  let getParams = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: Authorization,
    },
  };
  // TV识别
  if (category == "TV") {
    let AnimeSearchName = fileNameChaiJieArr[0];
    let animeErrName = AnimeSearchName;
    if (/\b(10|[1-9])\b/g.test(fileNameChaiJieArr[0])) {
      seasonNumBJ = (AnimeSearchName.match(/\b(10|[1-9])\b/g) || []).join("");
      AnimeSearchName = fileNameChaiJieArr[0]
        .replace(/\b(10|[1-9])\b/g, "")
        .trim();
      AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
    }
    if (/\b(S\d+|Season\s?\d+)\b/gi.test(fileNameChaiJieArr[0])) {
      seasonNumBJ = AnimeSearchName.match(/\b(S\d+|Season\s?\d+)\b/g).join("");
      seasonNumBJ = (seasonNumBJ.match(/\d+/) || []).join("");
      AnimeSearchName = fileNameChaiJieArr[0]
        .replace(/\b(S\d+|Season\s?\d+)\b/gi, "")
        .trim();
      AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
    } else {
      AnimeSearchName = AnimeSearchName.replace(/ /g, "%20");
    }

    // 查询TMDB的ID API
    let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${AnimeSearchName}&language=en-US&page=1`;
    let AnimeSearchID = await fetch(searchUrl, getParams)
      .then((res) => res.json())
      .then((json) => json.results[0].id)
      .catch((err) => console.log("番剧ID请求错误", err));
    let TMDBAlternativeTitlesUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}/alternative_titles`;
    let TMDBDetailsUrl = `https://api.themoviedb.org/3/tv/${AnimeSearchID}?language=zh-CN'`;
    let AnimeDetails = await fetch(TMDBDetailsUrl, getParams)
      .then((res) => res.json())
      .then((json) => json)
      .catch((err) => console.log("番剧详情请求错误", err));
    // 获取季数
    AnimeDetails.seasons.forEach((item) => {
      // 集数识别
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
            `${animeErrName}集数错误，请检查集数。本地集数：${episodeCount},查询结果集数：${AnimeDetails.seasons[seasonNumBJ].episode_count}。匹配中文名称：${AnimeDetails.name}。当前识别为：第${seasonNumBJ}季`
          );
      }
    });
    anime = {
      AnimeDetails,
      AnimeSearchID,
      chinaName,
      seasonNum,
      poster_path: AnimeDetails.poster_path,
    };
    console.log("查询番剧名称", animeErrName);
    console.log("匹配结果");
    console.log("TMDB_ID：" + AnimeSearchID);
    console.log("中文名称：" + chinaName);
    console.log("中文季节名称：" + chinaSeasonName);
    console.log("本季季数为：" + seasonNum, "本季集数：" + episodeCount);
  }
  if (category == "Movie") {
    let anime_movie_name = fileNameChaiJieArr[0];
    let temp_name = anime_movie_name;
    anime_movie_name = anime_movie_name.replace(/ /g, "%20");
    let tmdb_movie_search_api = `https://api.themoviedb.org/3/search/movie?query=${anime_movie_name}&include_adult=true&language=en-US&page=1`;
    let movie_search_id = await fetch(tmdb_movie_search_api, getParams)
      .then((res) => res.json())
      .then((json) => json.results[0].id)
      .catch((err) => console.log("电影ID请求错误", err));
    let tmdb_movie_details_api = `https://api.themoviedb.org/3/movie/${movie_search_id}?language=zh-CN`;
    let movie_details = await fetch(tmdb_movie_details_api, getParams)
      .then((res) => res.json())
      .then((json) => json)
      .catch((err) => console.log("电影详情请求错误", err));
    anime = {
      movie_details,
      movie_search_id,
      chinaName: movie_details.title,
      poster_path: movie_details.poster_path,
    };
    console.log("查询电影/剧场版名称", temp_name);
    console.log("匹配结果");
    console.log("TMDB_ID：" + movie_search_id);
    console.log("中文名称：" + movie_details.title);
  }
  return anime;
}

// 封面下载
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

let dir_treeArr = getDirectoryTreeFn(directoryPath);
seekFolderFn(dir_treeArr);
