import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import fsExtra from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import { execSync } from "child_process";
import { log } from "console";
// TMDB API访问令牌 Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZDUxNTViOTJkZjNiN2YxYWQxOWY4ZWY2YzI0NWFhNyIsIm5iZiI6MTcyODQyNDExMy42MjUxNTQsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ItGZGGpx5LJKyIUtlSnTsOsYzAQDrV-wQ3QIGHMPU7g
const Authorization =
  "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZDUxNTViOTJkZjNiN2YxYWQxOWY4ZWY2YzI0NWFhNyIsIm5iZiI6MTY4NDIzNjE4OC4zMzEsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.qunf2NcPt6fapXY_VdJ7vLZSDL72V3F6bdN5eFrm-iI";
// 指定识别位置
const DirectoryPath = "F:\\番剧识别\\matching";
//const DirectoryPath = "\\\\Fnos\\媒体库\\刮削\\matching";
// 指定生成位置
const New_dir_path = "F:\\番剧识别\\Succeed\\";
//const New_dir_path = "\\\\Fnos\\媒体库\\刮削\\Succeed\\";
// 特典关键词
const SpKeyWords = {
  Trailers: /promotion|PV|character Pv|CM|Preview|Trailer|Teaser/,
  Others: /NCED|NCOP|OP|ED|Menu|menu|MV|Easter Egg|Lyric Video|Music Video/i,
  Interviews: /IV|Making|Interview|Theater|Greeting|After Talk|Event/i,
  CDs: /flac|cue|wav|log|jpg|png/i,
};
const SubKeyWords = {
  sub: /VCB-Studio|VCB-S|jsum|mawen1250|philosophy-raws|Moozzi2|U2-Rip|AI-Raws|KitaujiSub|LoliHouse|ANi|Nekomoe kissaten|Sakurato|喵萌Production|Comicat|DMG|Airota|CASO|KissSub|SweetSub|UHA-WINGS|orion origin|BeanSub|SGS|ReinForce|Yousei-raws|Salender-Raws/,
  video_params: /1080p|x264|x265|HEVC|AVC|H264|H265|Hi10p|BDrip|SP/i,
  err_epi_num: /OAD|OVA|Extra|extra|SP|Vol.|\d{2}\.\d+|BD-BOX|Disc/,
  extname: /mkv|mp4/i,
  folderName: /Scans|Extra|EXTRA|CDs|SPs|Bonus/,
  errFileName: /(?<!\w)[-+](?!\w)|_|TV|SP|BD-BOX|Tokuten DVD|,/g,
};
const YearReg = /\b\d{4}\b/g;
const getParams = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: Authorization,
  },
};

function get_Dir_treeArrFn(dirPath) {
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
        get_Dir_treeArrFn(file)
      );
      i++;
    } else {
      fileListArr.push({ type: "file", path: file });
      i++;
    }
  });
  // console.log(fileListArr);
  return fileListArr;
}
let dir_treeArr = get_Dir_treeArrFn(DirectoryPath);
anime_discernFn(dir_treeArr);

function anime_discernFn(arrPramas) {
  let fileArr = [];
  let animeTV = [];
  let animeMovie = [];
  // console.log(arrPramas);
  // 整理文件树
  arrPramas.forEach((item) => {
    // console.log(item);
    if (item.type == "Folder") {
      let k = 0;
      // 检测合集
      if (item.sonFolder.length >= 1) {
        for (let i = 0; i < item.sonFolder.length; i++) {
          // console.log(item.sonFolder[i]);
          if (
            item.sonFolder[i].type == "Folder" &&
            !SubKeyWords.folderName.test(path.basename(item.sonFolder[i].path))
          ) {
            if (fileArr.length == 0) {
              fileArr.push(item.sonFolder[i]);
            } else if (
              fileArr[fileArr.length - 1].path != item.sonFolder[i].path
            ) {
              fileArr.push(item.sonFolder[i]);
            }
            continue;
          }
          // 捕获正常番剧
          if (
            item.sonFolder[i].type == "Folder" &&
            SubKeyWords.folderName.test(path.basename(item.sonFolder[i].path))
          ) {
            if (fileArr.length == 0) {
              fileArr.push(item);
            } else if (fileArr[fileArr.length - 1].path != item.path) {
              fileArr.push(item);
            }
            continue;
          }
          // 捕获不带特典或者jsum
          if (SubKeyWords.extname.test(path.basename(item.sonFolder[i].path))) {
            k++;
            if (k > 2) {
              if (fileArr.length == 0) {
                fileArr.push(item);
              } else if (fileArr[fileArr.length - 1].path != item.path) {
                fileArr.push(item);
              }
              continue;
            }
          }
        }
      }
      if (arrPramas.length == 1 && fileArr.length != 1) {
        fileArr.push(item);
      }
      // console.log(fileArr);
    }
  });
  // console.log("11");

  fileArr.forEach(async (item) => {
    // console.log(item);
    // return;
    if (/OAD|OVA/.test(item.path)) return;
    // 获取剧名 季别 类型 压制组
    let { subtitles, name, category, prototype_name, season_number } =
      subtitle_discernFn(item.path);
    // 获取集数
    let episode_count = tvEpisodeFn(item);
    console.log(
      `类型： ${category}  剧名：${name}  季别：${season_number}  集数：${episode_count}`
    );
    console.log("");
    // 获取TMDB ID
    if (category == "TV") {
      let animeTVid = null;
      let china_name = null;
      let year = 2000;
      let new_episode_number = null;

      // TMDB TV搜索 获取作品ID
      let res = await tv_search_resultsFn(name);
      // console.log("作品ID: ", res.results[0].id);
      // 搜索结果判断 如多有条结果
      if (res.total_results == 1) {
        animeTVid = res.results[0].id;
      } else {
        let { tv_ID, seasonNum } = await tv_alternative_titlesFn(
          res.results,
          name,
          season_number,
          episode_count
        );
        console.log("TVID: ", tv_ID);
        animeTVid = tv_ID;
        if (seasonNum != 0) season_number = seasonNum;
      }
      // console.log(`剧名：${name}  TMDB ID:${animeTVid}`);
      if (animeTVid == null) {
        console.log(`${name}:获取作品ID失败，本地集数:${episode_count}`);
        return;
      }
      // 获取作品中文年份名称
      let animeDetails = await tvDetailsFn(animeTVid);
      if (animeDetails.status_code) {
        console.log(`${name}:查找失败：请检查名字是否正确`);
        return;
      }
      china_name = animeDetails.name;
      // 请求结果有两季以上，且第一季不是特别篇，本地初识别是第一季的
      if (
        animeDetails.seasons.length >= 2 &&
        animeDetails.seasons[0].name != "特别篇" &&
        season_number == 1
      ) {
        let seasonNum = 0;
        let tv_alternative_titles_api = `https://api.themoviedb.org/3/tv/${animeTVid}/alternative_titles`;
        let titles = await fetch(tv_alternative_titles_api, getParams)
          .then((res) => res.json())
          .then((json) => json)
          .catch((err) => console.error("error:" + err));

        for (let i = 0; i < titles.results.length; i++) {
          if (
            titles.results[i].title.toLowerCase() == name.toLowerCase() &&
            titles.results[i].type != ""
          ) {
            console.log(titles.results[i].type);
            if (/(S|Season )0?(\d+)/gi.test(titles.results[i].type)) {
              seasonNum = parseInt(
                /(S|Season )0?(\d+)/gi.exec(titles.results[i].type)[2],
                10
              );
            }
            if (/Second Season/i.test(titles.results[i].type)) seasonNum = 2;
            if (/Third Season/i.test(titles.results[i].type)) seasonNum = 3;
            if (/2nd Season/i.test(titles.results[i].type)) seasonNum = 2;
            if (/3rd Season/i.test(titles.results[i].type)) seasonNum = 3;
            // console.log("多重季节识别：" + seasonNum);
            if (seasonNum != 0) season_number = seasonNum;
          }
        }
      }

      if (animeDetails.seasons[0].name == "特别篇") {
        year = animeDetails.seasons[1].air_date.slice(0, 4);
      } else {
        year = animeDetails.seasons[0].air_date.slice(0, 4);
      }

      if (!animeDetails.seasons) return;

      if (season_number == 1) {
        if (
          animeDetails.seasons.length == 2 &&
          animeDetails.seasons[0].name == "特别篇"
        ) {
          new_episode_number = animeDetails.seasons[1].episode_count;
          season_number = animeDetails.seasons[1].season_number;
        } else {
          for (let i = 0; i < animeDetails.seasons.length; i++) {
            if (animeDetails.seasons[i].name == "特别篇") continue;
            if (
              animeDetails.seasons[i].episode_count == episode_count &&
              season_number == animeDetails.seasons[i].season_number
            ) {
              new_episode_number = animeDetails.seasons[i].episode_count;
              season_number = animeDetails.seasons[i].season_number;
            }
            if (
              new_episode_number == null &&
              animeDetails.seasons[i].episode_count == episode_count
            ) {
              new_episode_number = animeDetails.seasons[i].episode_count;
              season_number = animeDetails.seasons[i].season_number;
            }
          }
        }
      } else {
        if (animeDetails.seasons.length < season_number) {
          console.log(
            `${name}:查找失败：请检查名字是否正确。季别${season_number}。集数${episode_count}`
          );
          return;
        }
        if (season_number >= 2 && animeDetails.seasons[0].name != "特别篇") {
          new_episode_number =
            animeDetails.seasons[season_number - 1].episode_count;
          season_number = animeDetails.seasons[season_number - 1].season_number;
        } else {
          new_episode_number =
            animeDetails.seasons[season_number].episode_count;
          season_number = animeDetails.seasons[season_number].season_number;
        }
      }
      // console.log(`${name}   ${china_name}(${year})`);
      // 集数匹配失败
      if (new_episode_number == null) {
        console.log("   ");
        console.log(
          `${name}匹配失败，集数不匹配，请检查集数。本地集数：${episode_count}`
        );
        return;
      } else {
        console.log("   ");
        console.log("查询番剧名称：" + name);
        console.log("匹配结果");
        console.log("TMDB_ID：" + animeTVid);
        console.log("中文名称：" + china_name);
        console.log(
          "本季季数为：" + season_number,
          "本季集数：" + new_episode_number
        );
      }
      // return;
      if (china_name != null && china_name != "undefined") {
        await tvSortTidyFn(
          `${china_name}(${year})`,
          item.path,
          subtitles,
          animeDetails.poster_path,
          season_number
        );
      }
    }
    if (category == "movie") {
      let anime_movie = await tmdb_movie_requestFn(name);
      if (anime_movie == null) return;
      // return;
      if (anime_movie.chinaName != "" && anime_movie.chinaName != "undefined") {
        await movieSortTidyFn(
          `${anime_movie.chinaName}(${anime_movie.year})`,
          item.path,
          subtitles,
          anime_movie.poster_path
        );
      }
    }
  });
}

// subtitles识别
function subtitle_discernFn(path_name) {
  let prototype_name = null;
  let name = null;
  let season_number = 1;
  let subtitles = null;
  let category_discern = null;

  // 判断是否被[]全包裹
  if (path.basename(path_name).replace(/\[([^\]]+)\]/g, "") == "") {
    path_name.match(/\[.*?\]/g).forEach((item, index) => {
      if (/movie/i.test(item)) {
        category_discern = "movie";
      } else if (category_discern === null) category_discern = "TV";

      // []全包裹下，使用第二[]包裹的内容作为识别名字
      if (name == null && index == 1) {
        prototype_name = item.slice(1, -1);
        prototype_name = prototype_name.replace(SubKeyWords.errFileName, "");
        name = item.slice(1, -1);
      }
      //一般压制组
      if (SubKeyWords.sub.test(item) && index == 0) {
        subtitles = item.match(SubKeyWords.sub).join("");
      }
      // 识别jsum
      if (YearReg.test(item) && index == 0 && subtitles === null)
        subtitles = "jsum";
      if (/AI-Raws/i.test(item) && subtitles === null) {
        subtitles = "AI-Raws";
      }
      // 季节识别
      if (index == 1 && category_discern == "TV") {
        let seasonDiscern = seasonDiscernFn(prototype_name);
        name = seasonDiscern.name;
        season_number = seasonDiscern.season_number;
      }
    });
  } else {
    // 类型识别
    let m = 0;
    get_Dir_treeArrFn(path_name).forEach((item) => {
      if (
        item.type == "file" &&
        SubKeyWords.extname.test(path.extname(item.path))
      )
        m++;
    });
    if (/movie/i.test(path_name) || m < 3) {
      category_discern = "movie";
    } else if (category_discern === null) category_discern = "TV";

    // 压制组识别 取第一个[]包裹的内容作为压制组
    let pathNameCJ = path.basename(path_name).match(/\[.*?\]/g) || [];
    prototype_name = path.basename(path_name).replace(/\[([^\]]+)\]/g, "");
    prototype_name = prototype_name.replace(SubKeyWords.errFileName, "");
    pathNameCJ.push(prototype_name.trim());

    if (SubKeyWords.sub.test(pathNameCJ[0])) {
      subtitles = pathNameCJ[0].slice(1, -1).trim();
    }

    // TV 季节处理
    if (category_discern == "TV") {
      let seasonDiscern = seasonDiscernFn(prototype_name);
      name = seasonDiscern.name;
      season_number = seasonDiscern.season_number;
    }
    if (category_discern == "movie") {
      name = prototype_name;
    }
  }
  // console.log("剧名：" + name, "季别：" + season_number);
  return {
    subtitles,
    name: name.replace(SubKeyWords.errFileName, " ").trim(),
    category: category_discern,
    prototype_name,
    season_number,
  };
}

// 季节识别
function seasonDiscernFn(fileName) {
  let name = null;
  let season_number = null;

  if (/(S|Season )0?(\d+)/gi.test(fileName) && season_number == null) {
    name = fileName.replace(/(S|Season )0?(\d+)/gi, "").trim();
    // season_number = fileName.match(/(S|Season )0?(\d+)/gi).join("");
    season_number = parseInt(/(S|Season )0?(\d+)/gi.exec(fileName)[2], 10);
  }
  if (/1st Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/1st Season/i, "").trim();
    season_number = 1;
  }
  if (/2nd Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/2nd Season/i, "").trim();
    season_number = 2;
  }
  if (/3rd Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/3rd Season/i, "").trim();
    season_number = 3;
  }
  if (/Second Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/Second Season/i, "").trim();
    season_number = 2;
  }
  if (/Third Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/Third Season/i, "").trim();
    season_number = 3;
  }
  // 含有单独的阿拉伯数字
  if (/\b(?:[1-9]|1[0-9]|20)\b/g.test(fileName) && season_number == null) {
    name = fileName.replace(/\b(?:[1-9]|1[0-9]|20)\b/g, " ").trim();
    season_number = fileName.match(/\b(?:[1-9]|1[0-9]|20)\b/g).join("");
  }
  // 名字最后一个字符为数字
  if (/\d$/.test(fileName) && season_number == null) {
    name = fileName.replace(/\d$/, " ").trim();
    season_number = fileName.match(/\d$/).join("");
  }
  // 含有罗马数字
  if (/\b[IVXLCDM]+\b/g.test(fileName) && season_number == null) {
    name = fileName.replace(/\b[IVXLCDM]+\b/g, "").trim();
    season_number = fileName.match(/\b[IVXLCDM]+\b/g).join("");
    switch (season_number) {
      case "I":
        season_number = 1;
        break;
      case "II":
        season_number = 2;
        break;
      case "III":
        season_number = 3;
        break;
      case "IV":
        season_number = 4;
        break;
      case "V":
        season_number = 5;
        break;
      case "VI":
        season_number = 6;
        break;
    }
  }

  if (season_number == null) {
    season_number = 1;
  }
  if (name == null) {
    name = fileName;
  }
  return { name, season_number };
}

// 集数识别
function tvEpisodeFn(TVObj) {
  let num = 0;
  if (TVObj.sonFolder.length >= 1) {
    TVObj.sonFolder.forEach((item) => {
      // [01] #01 01
      if (
        item.type == "file" &&
        SubKeyWords.extname.test(path.extname(item.path)) &&
        (/\[(0[1-9]|[1-9][0-9]*)\]/.test(path.basename(item.path)) ||
          /#(0[1-9]|[1-9][0-9]*)/.test(path.basename(item.path)) ||
          /\b(0[1-9]|[1-9][0-9])\b/g.test(path.basename(item.path))) &&
        !SubKeyWords.err_epi_num.test(path.basename(item.path))
      ) {
        num += 1;
      }
    });
  } else {
    TVObj.forEach((item) => {
      if (
        item.type == "file" &&
        SubKeyWords.extname.test(path.extname(item.path)) &&
        (/\[(0[1-9]|[1-9][0-9])\]/.test(path.basename(item.path)) ||
          /#(0[1-9]|[1-9][0-9]*)/.test(path.basename(item.path)) ||
          /\b(0[1-9]|[1-9][0-9])\b/g.test(path.basename(item.path))) &&
        !SubKeyWords.err_epi_num.test(path.basename(item.path))
      ) {
        num += 1;
      }
    });
  }

  return num;
}

// TV分类整理移动
// 需求：对文件夹内的文件进行分类重命名并下载其封面
// 参数需求：名字、季数、以及文件原路径、字幕组\压制组名字、封面下载
// 文件新路径

async function tvSortTidyFn(
  name,
  old_file_path,
  subtitles,
  poster_path,
  season_number
) {
  let new_file_path = New_dir_path.concat(`${name}`);

  if (!fs.existsSync(new_file_path)) {
    fs.mkdir(new_file_path, (err) => {});
  }

  // 下载infuse所需封面
  // downloadImageFn(poster_path, new_file_path);

  // 获取新的目录树
  let fileTree = get_Dir_treeArrFn(old_file_path);

  fileTree.forEach((item) => {
    // 文件夹创建
    folderFountFn("TV", new_file_path, season_number);
    // 集数重命名
    if (item.type == "file") {
      sleepFn(100);
      if (
        (/\[(0[1-9]|[1-9][0-9]*)\]/.test(path.basename(item.path)) ||
          /#(0[1-9]|[1-9][0-9]*)/.test(path.basename(item.path)) ||
          /\b(0[1-9]|[1-9][0-9])\b/g.test(path.basename(item.path)) ||
          /EP(\d+)/.test(path.basename(item.path))) &&
        (SubKeyWords.extname.test(path.extname(item.path)) ||
          path.extname(item.path) == ".ass") &&
        !SubKeyWords.err_epi_num.test(path.basename(item.path))
      ) {
        let houZhui = null;
        if (path.extname(item.path) == ".mkv") {
          houZhui = ".mkv";
        }
        if (path.extname(item.path) == ".mp4" && houZhui == null) {
          houZhui = ".mp4";
        }
        if (path.extname(item.path) == ".ass") {
          if (/sc|SC|chs|CHS/.test(path.basename(item.path))) {
            houZhui = ".zh-CN.ass";
          }
          if (/tc|TC|cht|CHT/.test(path.basename(item.path))) {
            houZhui = ".zh-TW.ass";
          }
          if (
            !/sc|SC|chs|CHS/.test(path.basename(item.path)) &&
            !/tc|TC|cht|CHT/.test(path.basename(item.path))
          )
            return;
        }
        // 集数提取
        if (/\[(0[1-9]|[1-9][0-9])\]/.test(path.basename(item.path))) {
          let episodeNum = path
            .basename(item.path)
            .match(/\[(0[1-9]|[1-9][0-9])\]/)[1];
          tvReNameFn(
            item.path,
            `${new_file_path}\\Season 0${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
          );
        }
        if (/#(0[1-9]|[1-9][0-9]*)/.test(path.basename(item.path))) {
          let episodeNum = path
            .basename(item.path)
            .match(/#(0[1-9]|[1-9][0-9]*)/)[1];
          tvReNameFn(
            item.path,
            `${new_file_path}\\Season 0${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
          );
        }
        if (/\b(0[1-9]|[1-9][0-9])\b/g.test(path.basename(item.path))) {
          let episodeNum = path
            .basename(item.path)
            .match(/\b(0[1-9]|[1-9][0-9])\b/g)
            .join();
          tvReNameFn(
            item.path,
            `${new_file_path}\\Season 0${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
          );
        }
      }
    }
    // SPs 分类处理
    if (subtitles == "jsum") {
      sleepFn(100);
      let i = 1;
      if (path.extname(item.path) == ".mkv") {
        if (SpKeyWords.Trailers.test(path.basename(item.path))) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Trailers,
            seasonNum: season_number,
            chinaName: name,
            path: item.path,
          });
          tvReNameFn(
            item.path,
            `${new_file_path}\\Trailers\\${new_SP_Name}.mkv`
          );
        }
        if (SpKeyWords.Others.test(path.basename(item.path))) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Others,
            seasonNum: season_number,
            chinaName: name,
            path: item.path,
          });
          if (/Menu(?!\s*\d)/.test(new_SP_Name)) {
            let strtemp = path
              .basename(item.path)
              .match(/(Disc\s*\d+|Disc\d+|Vol\.?\s*\d+)/i);
            function extractInfo(filename) {
              let volMatch = filename.match(/\[Vol\.?\s*\d+]/);
              let bdBoxMatch = filename.match(/\[BD-BOX\s*\d+\]/);
              let discMatch = filename.match(/\[Disc\s*\d+\]/);
              let menuMatch = filename.match(/\[Menu\s*\d+\]/);
              let resultParts = [];
              if (bdBoxMatch) {
                resultParts.push(bdBoxMatch[0].replace(/[\[\]]/g, "")); // 去掉中括号
              }
              if (discMatch) {
                resultParts.push(discMatch[0].replace(/[\[\]]/g, ""));
              }
              if (volMatch) {
                resultParts.push(volMatch[0].replace(/[\[\]]/g, ""));
              }
              if (menuMatch) {
                resultParts.push(menuMatch[0].replace(/[\[\]]/g, ""));
              } else {
                resultParts.push("Menu");
              }
              return resultParts.length > 0 ? resultParts.join(" ") : null;
            }
            let output =
              "Season 0" + season_number + " " + extractInfo(item.path);

            new_SP_Name = output;
          }
          tvReNameFn(item.path, `${new_file_path}\\Extras\\${new_SP_Name}.mkv`);
        }
        if (SpKeyWords.Interviews.test(path.basename(item.path))) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Interviews,
            seasonNum: season_number,
            chinaName: name,
            path: item.path,
          });
          tvReNameFn(
            item.path,
            `${new_file_path}\\Interviews\\${new_SP_Name}.mkv`
          );
        }
      }
      if (
        path.extname(item.path) == ".rar" ||
        path.extname(item.path) == ".zip"
      ) {
        if (!fs.existsSync(`${old_file_path}\\${name} CDs`)) {
          fs.mkdir(`${old_file_path}\\${name} CDs`, (err) => {});
        }
        // fs.renameSync(
        //   item.path,
        //   `${old_file_path}\\${name} CDs\\${path.basename(item.path)}`,
        //   (err) => {}
        // );
        // sleepFn(200);
      }
    }
    if (
      item.type == "Folder" &&
      (path.basename(item.path) == "SPs" || path.basename(item.path) == "Bonus")
    ) {
      item.sonFolder.forEach((twoItem) => {
        sleepFn(100);
        if (
          SpKeyWords.Others.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Others,
            seasonNum: season_number,
            chinaName: name,
            path: twoItem.path,
          });
          tvReNameFn(
            twoItem.path,
            `${new_file_path}\\Extras\\${new_SP_Name}.mkv`
          );
        }
        if (
          SpKeyWords.Trailers.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Trailers,
            seasonNum: season_number,
            chinaName: name,
            path: twoItem.path,
          });
          tvReNameFn(
            twoItem.path,
            `${new_file_path}\\Trailers\\${new_SP_Name}.mkv`
          );
        }
        if (
          SpKeyWords.Interviews.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Interviews,
            seasonNum: season_number,
            chinaName: name,
            path: twoItem.path,
          });
          tvReNameFn(
            twoItem.path,
            `${new_file_path}\\Interviews\\${new_SP_Name}.mkv`
          );
        }
      });
    }
    if (item.type == "Folder" && path.basename(item.path) == "CDs") {
      // if (!fs.existsSync(`${old_file_path}\\${name} CDs`)) {
      //   fs.renameSync(item.path, `${old_file_path}\\${name} CDs`, (err) => {});
      //   sleepFn(500);
      // }
      if (!fs.existsSync(`${old_file_path}\\${name} CDs`)) {
        fs.mkdir(`${old_file_path}\\${name} CDs`, (err) => {});
      }
      // if (!fs.existsSync(`${new_file_path}\\${name} CDs`)) {
      //   fs.mkdir(`${new_file_path}\\${name} CDs`, (err) => {});
      // }
      // item.sonFolder.forEach((twoItem) => {
      //   fs.renameSync(
      //     twoItem.path,
      //     `${new_file_path}\\${name} CDs\\${path.basename(twoItem.path)}`,
      //     (err) => {
      //       if (err != null) console.log("CDs 移动失败：", err);
      //     }
      //   );
      // });
    }
  });
}

async function movieSortTidyFn(
  movie_name,
  old_file_path,
  subtitles,
  poster_path
) {
  // 文件新路径
  let new_file_path = New_dir_path.concat(`Movie\\${movie_name}`);
  // 文件夹重命名
  if (!fs.existsSync(new_file_path)) {
    fs.mkdir(new_file_path, (err) => {});
  }
  // 分类文件夹创建
  folderFountFn("movie", new_file_path, 1);
  // console.log(get_Dir_treeArrFn(new_file_path));
  // infuse封面
  // downloadImageFn(poster_path, new_file_path);
  // 获取新的文件目录
  let fileDirArr = get_Dir_treeArrFn(old_file_path);
  let fileSizeArr = [];
  let subtitlesArr = [];
  fileDirArr.forEach((item) => {
    if (
      SubKeyWords.extname.test(path.extname(item.path)) &&
      item.type == "file"
    ) {
      let stats = fs.statSync(item.path);
      fileSizeArr.push({
        size: stats.size,
        path: item.path,
      });
      // 特典文件处理
      if (subtitles == "jsum") {
        if (
          item.type == "file" &&
          SubKeyWords.extname.test(path.extname(item.path))
        ) {
          movieSpReNameFn(item.path, new_file_path, movie_name);
        }
      }
    }
    // 一般特典处理
    if (
      item.type == "Folder" &&
      (path.basename(item.path) == "SPs" || path.basename(item.path) == "Bonus")
    ) {
      item.sonFolder.forEach((twoItem) => {
        if (SubKeyWords.extname.test(path.extname(twoItem.path)))
          movieSpReNameFn(twoItem.path, new_file_path, movie_name);
      });
    }
    // CD处理
    if (item.type == "Folder" && path.basename(item.path) == "CDs")
      if (!fs.existsSync(`${old_file_path}\\${movie_name} CDs`)) {
        fs.mkdir(`${old_file_path}\\${movie_name} CDs`, (err) => {});
      }
    if (path.extname(item.path) == ".rar" && subtitles == "jsum") {
      if (!fs.existsSync(`${old_file_path}\\${movie_name} CDs`)) {
        fs.mkdir(`${old_file_path}\\${movie_name} CDs`, (err) => {});
      }
      // fs.renameSync(
      //   item.path,
      //   `${new_file_path}\\${movie_name} CDs\\${path.basename(item.path)}`,
      //   (err) => {
      //     if (err != null) console.log("CDs 移动失败：", err);
      //   }
      // );
    }
    // 字幕处理
    if (item.type == "file" && path.extname(item.path) == ".ass") {
      subtitlesArr.push(item);
    }
  });
  // 取文件夹中最大的视频文件作为电影
  if (fileSizeArr.length != 0) {
    let sizeMax = 0;
    let movie = null;
    let movieName = null;
    for (let i = 0; i < fileSizeArr.length; i++) {
      if (fileSizeArr[i].size > sizeMax) {
        sizeMax = fileSizeArr[i].size;
        movie = fileSizeArr[i];
      }
    }
    if (fs.existsSync(movie.path)) {
      ffmpeg.ffprobe(movie.path, (err, videoDate) => {
        if (err) {
          console.error("无法获取视频信息:", err);
          return;
        }
        // console.log("视频文件信息:", videoDate.format);
        // console.log("视频文件信息:", videoDate.streams);

        let videoHeight = videoDate.streams[0].height;
        if (videoHeight == "N/A") videoHeight = 1080;
        movieName = `${new_file_path}\\${movie_name} - ${videoHeight}p - ${subtitles}`;
        let movie_new_path = `${new_file_path}\\${movie_name} - ${videoHeight}p - ${subtitles}${path.extname(
          movie.path
        )}`;
        movieReNameFn(movie.path, movie_new_path);
        if (subtitlesArr.length != 0) {
          subtitlesArr.forEach((item) => {
            if (/sc|SC|chs|CHS/.test(path.basename(item.path))) {
              movieReNameFn(item.path, `${movieName}.zh-CN.ass`);
            }
            if (/tc|TC|cht|CHT/.test(path.basename(item.path))) {
              movieReNameFn(item.path, `${movieName}.zh-TW.ass`);
            }
          });
        }
      });
    }
  }
}

function sleepFn(milliseconds) {
  const start = Date.now();
  let now = null;
  // 循环直到指定时间过去
  do {
    now = Date.now();
  } while (now - start < milliseconds);
}

// 创建分类文件夹
function folderFountFn(keyWords, pathName, seasonNum) {
  if (seasonNum < 10) seasonNum = `0${seasonNum}`;
  if (keyWords != "movie") {
    if (!fs.existsSync(`${pathName}\\Season ${seasonNum}`)) {
      fs.mkdir(`${pathName}\\Season ${seasonNum}`, (err) => {});
    }
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
}

// TV集数重命名
function tvReNameFn(oldPath, newPath) {
  fs.rename(oldPath, newPath, (err) => {
    // if (err != null) console.log(oldPath, "TV重命名失败：", err);
  });
}
``;
// 电影重命名
function movieReNameFn(old_path, new_path) {
  fs.rename(old_path, new_path, (err) => {
    // if (err != null) console.log(old_path, "电影ReName失败：", err);
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
      newName = `Season 0${spsObj.seasonNum} ${chaiJieArr[i].substring(
        1,
        chaiJieArr[i].length - 1
      )}`;
    }
  }
  return newName;
}

// 特典重命名处理
function spReNameFn(pathName, new_file_path, chinaName, seasonNum, keyWords) {
  let extname = path.extname(pathName);
  if (SpKeyWords.Trailers.test(path.basename(pathName))) {
    let new_SP_Name = fileSPsReNameFn({
      keyWords,
      seasonNum,
      chinaName,
      path: pathName,
    });
    tvReNameFn(
      pathName,
      `${new_file_path}\\Trailers\\${new_SP_Name}${extname}`
    );
    return;
  }
  if (SpKeyWords.Trailers.test(path.basename(pathName))) {
    let new_SP_Name = fileSPsReNameFn({
      keyWords,
      seasonNum,
      chinaName,
      path: pathName,
    });
    tvReNameFn(pathName, `${new_file_path}\\Extras\\${new_SP_Name}${extname}`);
    return;
  }
  if (SpKeyWords.Trailers.test(path.basename(pathName))) {
    let new_SP_Name = fileSPsReNameFn({
      keyWords,
      seasonNum,
      chinaName,
      path: pathName,
    });
    tvReNameFn(
      pathName,
      `${new_file_path}\\Interviews\\${new_SP_Name}${extname}`
    );
    return;
  }
}
// 电影特典文件重命名
function movieSpReNameFn(now_path, new_file_path, movie_name) {
  if (SpKeyWords.Others.test(now_path)) {
    let movie_sp_new_path = `${new_file_path}\\Extras\\${movie_name} ${movieSpNameFn(
      now_path,
      SpKeyWords.Others
    )}${path.extname(now_path)}`;
    movieReNameFn(now_path, movie_sp_new_path);
  }
  if (SpKeyWords.Trailers.test(now_path)) {
    let movie_sp_new_path = `${new_file_path}\\Trailers\\${movie_name} ${movieSpNameFn(
      now_path,
      SpKeyWords.Trailers
    )}${path.extname(now_path)}`;
    movieReNameFn(now_path, movie_sp_new_path);
  }
  if (SpKeyWords.Interviews.test(now_path)) {
    let movie_sp_new_path = `${new_file_path}\\Interviews\\${movie_name} ${movieSpNameFn(
      now_path,
      SpKeyWords.Interviews
    )}${path.extname(now_path)}`;
    movieReNameFn(now_path, movie_sp_new_path);
  }
}
// TMDB请求
async function tmdb_movie_requestFn(movie_name) {
  let chinaName = "";
  let poster_path = "";
  let anime_movie_name = movie_name.replace(/ /g, "%20");
  let tmdb_movie_search_api = `https://api.themoviedb.org/3/search/movie?query=${anime_movie_name}&include_adult=true&language=en-US&page=1`;
  let movie_search_id = await fetch(tmdb_movie_search_api, getParams)
    .then((res) => res.json())
    .then((json) => json.results[0].id)
    .catch((err) => console.log("电影ID请求错误", err));
  if (movie_search_id == undefined) {
    console.log(`${movie_name}：无搜索到作品，请检查电影名称是否正确`);
    return null;
  }

  let tmdb_movie_details_api = `https://api.themoviedb.org/3/movie/${movie_search_id}?language=zh-CN`;
  let anime_movie_details = await fetch(tmdb_movie_details_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log("电影详情请求错误", err));
  poster_path = anime_movie_details.poster_path;
  chinaName = anime_movie_details.title;
  console.log("   ");
  console.log("查询电影/剧场版名称：" + movie_name);
  console.log("匹配结果");
  console.log("TMDB_ID：" + movie_search_id);
  console.log("中文名称：" + anime_movie_details.title);
  return {
    details: anime_movie_details,
    chinaName,
    poster_path,
    year: anime_movie_details.release_date.slice(0, 4),
  };
}

async function tv_search_resultsFn(anime_name) {
  anime_name = anime_name.replace(/ /g, "%20");
  let tv_search_api = `https://api.themoviedb.org/3/search/tv?query=${anime_name}&language=en-US&page=1`;

  let tv_search_results = await fetch(tv_search_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log(anime_name + "ID请求错误", err));
  // console.log("作品ID:", tv_search_results);
  return tv_search_results;
}

async function tvDetailsFn(tv_ID) {
  let tv_Details_api = `https://api.themoviedb.org/3/tv/${tv_ID}?language=zh-CN'`;
  let anime_tv_Details = await fetch(tv_Details_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log(tv_ID + "详情请求错误", err));
  return anime_tv_Details;
}

async function tv_alternative_titlesFn(
  tvDetailsArr,
  animeName,
  season_number,
  episode_num
) {
  let tv_ID = null;
  let seasonNum = 0;
  for (let i = 0; i < tvDetailsArr.length; i++) {
    let tv_alternative_titles_api = `https://api.themoviedb.org/3/tv/${tvDetailsArr[i].id}/alternative_titles`;
    let titles = await fetch(tv_alternative_titles_api, getParams)
      .then((res) => res.json())
      .then((json) => json)
      .catch((err) => console.error("error:" + err));
    let animeDetails = await tvDetailsFn(tvDetailsArr[i].id);
    // console.log("作品名字: ", titles.results);
    for (let k = 0; k < titles.results.length; k++) {
      if (tv_ID != null) break;
      if (new RegExp(animeName, "i").test(titles.results[k].title)) {
        // 捕获标题无注明季节的
        if (
          titles.results[k].title == animeName &&
          titles.results[k].type != ""
        ) {
          // console.log(titles.results[k].type);
          if (/(S|Season )0?(\d+)/gi.test(titles.results[k].type)) {
            seasonNum = parseInt(
              /(S|Season )0?(\d+)/gi.exec(titles.results[k].type)[2],
              10
            );
          }
        }
        // 获取作品ID
        if (
          animeDetails.seasons[0].name == "特别篇" &&
          animeDetails.seasons.length < season_number + 1
        )
          continue;
        if (
          animeDetails.seasons[0].name != "特别篇" &&
          animeDetails.seasons.length < season_number
        )
          continue;
        if (
          season_number == 1 &&
          animeDetails.seasons[0].name != "特别篇" &&
          animeDetails.seasons[season_number - 1].episode_count ==
            episode_num &&
          tv_ID == null
        ) {
          tv_ID = tvDetailsArr[i].id;
        }
        if (
          season_number == 1 &&
          animeDetails.seasons[0].name == "特别篇" &&
          animeDetails.seasons[season_number].episode_count == episode_num &&
          tv_ID == null
        ) {
          tv_ID = tvDetailsArr[i].id;
        }
        if (
          season_number > 1 &&
          animeDetails.seasons.length > 1 &&
          animeDetails.seasons[0].name != "特别篇" &&
          animeDetails.seasons[season_number - 1].episode_count ==
            episode_num &&
          tv_ID == null
        ) {
          tv_ID = tvDetailsArr[i].id;
        }
        if (
          season_number > 1 &&
          animeDetails.seasons.length > 1 &&
          animeDetails.seasons[0].name == "特别篇" &&
          animeDetails.seasons[season_number].episode_count == episode_num &&
          tv_ID == null
        ) {
          tv_ID = tvDetailsArr[i].id;
        }
        break;
      }
    }
    if (tv_ID != null) {
      break;
    }
  }
  sleepFn(100);
  return { tv_ID, seasonNum };
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

// let dir_treeArr = get_Dir_treeArrFn(DirectoryPath);
// anime_discernFn(dir_treeArr);
