import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import fsExtra from "fs-extra";
import { execSync } from "child_process";
// TMDB API访问令牌
const Authorization =
  "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZDUxNTViOTJkZjNiN2YxYWQxOWY4ZWY2YzI0NWFhNyIsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.SuKbhiYAxIhSQTYK3__Q09MhL2DaL5w-RziJEKwEyS4";
// 指定识别位置
const DirectoryPath = "G:\\Sort";
// 指定生成位置
const New_dir_path = "G:\\115_Downloads\\";
// 特典关键词
const SpKeyWords = {
  Trailers: /promotion|PV|character Pv|CM|Preview|Trailer|Teaser/,
  Others: /NCED|NCOP|OP|ED|Menu|menu|MV|Easter Egg|Lyric Video/i,
  Interviews: /IV|Making|Interview/i,
  CDs: /flac|cue|wav|log|jpg|png/i,
};
const SubKeyWords = {
  sub: /VCB-Studio|VCB-S|jsum|mawen1250|philosophy-raws|Moozzi2|U2-Rip|AI-Raws/,
  video_params: /1080p|x264|x265|HEVC|AVC|H264|H265|Hi10p|BDrip|SP/i,
  err_epi_num: /OAD|OVA|Extra|extra|SP|Vol./,
  extname: /mkv|mp4/i,
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
  return fileListArr;
}

function anime_discernFn(arrPramas) {
  arrPramas.forEach(async (item, index) => {
    if (item.type == "Folder" && item.sonFolder.length >= 1) {
      // 字幕组识别
      let subtitles = subtitle_discernFn(item.path);
      let china_name = null;
      let china_season_name = null;
      let season_number = null;
      let new_episode_number = null;

      if (subtitles.category == "TV") {
        let episode_num = tvEpisodeFn(item);

        // console.log(subtitles, episode_num);
        let anime_tmdb_id = await tv_search_resultsFn(subtitles.name);

        // console.log(subtitles, episode_num, anime_tmdb_id);

        if (anime_tmdb_id.total_results == 1) {
          anime_tmdb_id = anime_tmdb_id.results[0].id;
        } else {
          anime_tmdb_id = await tv_alternative_titlesFn(
            anime_tmdb_id.results,
            subtitles.name,
            subtitles.season_number,
            episode_num
          );
        }

        if (anime_tmdb_id == null) {
          console.log("查询失败：" + path.basename(item.path));
          console.log(subtitles, "本地集数：" + episode_num);
          return;
        }
        // return;
        let animeDetails = await tvDetailsFn(anime_tmdb_id);
        china_name = animeDetails.name;
        if (subtitles.season_number == 1) {
          if (
            animeDetails.seasons.length == 2 &&
            animeDetails.seasons[0].name == "特别篇"
          ) {
            china_season_name = animeDetails.seasons[1].name;
            new_episode_number = animeDetails.seasons[1].episode_count;
            season_number = animeDetails.seasons[1].season_number;
          } else {
            for (let i = 0; i < animeDetails.seasons.length; i++) {
              if (animeDetails.seasons[i].name == "特别篇") continue;
              if (
                animeDetails.seasons[i].episode_count == episode_num &&
                subtitles.season_number == animeDetails.seasons[i].season_number
              ) {
                china_season_name = animeDetails.seasons[i].name;
                new_episode_number = animeDetails.seasons[i].episode_count;
                season_number = animeDetails.seasons[i].season_number;
              } else if (new_episode_number == null) {
                china_season_name = animeDetails.seasons[i].name;
                new_episode_number = animeDetails.seasons[i].episode_count;
                season_number = animeDetails.seasons[i].season_number;
              }
            }
          }
        } else {
          // console.log(animeDetails.seasons);
          if (
            subtitles.season_number >= 2 &&
            animeDetails.seasons[0].name != "特别篇"
          ) {
            china_season_name =
              animeDetails.seasons[subtitles.season_number - 1].name;
            new_episode_number =
              animeDetails.seasons[subtitles.season_number - 1].episode_count;
            season_number =
              animeDetails.seasons[subtitles.season_number - 1].season_number;
          } else {
            china_season_name =
              animeDetails.seasons[subtitles.season_number].name;
            new_episode_number =
              animeDetails.seasons[subtitles.season_number].episode_count;
            season_number =
              animeDetails.seasons[subtitles.season_number].season_number;
          }
        }
        // 集数匹配失败
        if (new_episode_number == null) {
          console.log("   ");
          console.log(
            `${subtitles.name}匹配失败，集数不匹配，请检查集数。本地集数：${episode_num}`
          );
        } else {
          console.log("   ");
          console.log("查询番剧名称：" + subtitles.prototype_name);
          console.log("匹配结果");
          console.log("TMDB_ID：" + anime_tmdb_id);
          console.log("中文名称：" + china_name);
          console.log("中文季节名称：" + china_season_name);
          console.log(
            "本季季数为：" + season_number,
            "本季集数：" + new_episode_number
          );
        }
        // return;
        if (china_name != "" && china_name != "undefined") {
          await tvSortTidyFn(
            china_name,
            item.path,
            subtitles.subtitles,
            animeDetails.poster_path,
            season_number
          );
        }
      }
      if (subtitles.category == "movie") {
        let anime_movie = await tmdb_movie_requestFn(subtitles.name);
        // return;
        if (
          anime_movie.chinaName != "" &&
          anime_movie.chinaName != "undefined"
        ) {
          await movieSortTidyFn(
            anime_movie.chinaName,
            item.path,
            subtitles.subtitles,
            anime_movie.poster_path
          );
        }
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
        let seasonDiscern = seasonDiscernFn(item.slice(1, -1));
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
    pathNameCJ.push(prototype_name.trim());

    if (SubKeyWords.sub.test(pathNameCJ[0])) {
      subtitles = pathNameCJ[0].slice(1, -1).trim();
    }

    // TV 季节处理
    if (category_discern == "TV") {
      let seasonDiscern = seasonDiscernFn(pathNameCJ[pathNameCJ.length - 1]);
      name = seasonDiscern.name;
      season_number = seasonDiscern.season_number;
    }
  }
  console.log(name, season_number);
  return {
    subtitles,
    name: name.trim(),
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
  if (/2nd Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/2nd Season/i, "").trim();
    season_number = 2;
  }
  if (/3rd Season/i.test(fileName) && season_number == null) {
    name = fileName.replace(/3rd Season/i, "").trim();
    season_number = 3;
  }
  // 含有单独的阿拉伯数字
  if (/\b(?:[1-9]|1[0-9]|20)\b/g.test(fileName) && season_number == null) {
    name = fileName.replace(/\b(?:[1-9]|1[0-9]|20)\b/g, " ").trim();
    season_number = fileName.match(/\b(?:[1-9]|1[0-9]|20)\b/g).join("");
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
function tvEpisodeFn(VcbEObj) {
  let num = 0;
  VcbEObj.sonFolder.forEach((item) => {
    // if (/#([1-9][0-9]|0[1-9])/g.test(path.basename(item.path))) {
    //   console.log(666);
    // }

    if (
      item.type == "file" &&
      SubKeyWords.extname.test(path.extname(item.path)) &&
      (/\[(0[1-9]|[1-9][0-9])\]/.test(path.basename(item.path)) ||
        new RegExp("\\d{2}\\(\\d{2}\\)").test(path.basename(item.path)) ||
        /#([1-9][0-9]|0[1-9])/g.test(path.basename(item.path)) ||
        /#(0[0-9]{2}|[1-9][0-9]{2})\b/g.test(path.basename(item.path)) ||
        /\[(00[1-9]|0[1-9]\d|[1-9]\d{2})\]/g.test(path.basename(item.path))) &&
      !SubKeyWords.err_epi_num.test(path.basename(item.path))
    ) {
      num += 1;
    }
  });
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
  downloadImageFn(poster_path, new_file_path);

  // 获取新的目录树
  let fileTree = get_Dir_treeArrFn(old_file_path);
  fileTree.forEach((item) => {
    // 文件夹创建
    folderFountFn("TV", new_file_path, season_number);
    // 集数重命名
    if (item.type == "file") {
      if (
        (/\[(0[0-9]|[1-9][0-9])\]/.test(path.basename(item.path)) ||
          new RegExp("\\d{2}\\(\\d{2}\\)").test(path.basename(item.path)) ||
          /\b#(0[1-9]|[1-9][0-9])\b/g.test(path.basename(item.path)) ||
          /\[(00[1-9]|0[1-9]\d|[1-9]\d{2})\]/g.test(
            path.basename(item.path)
          )) &&
        (SubKeyWords.extname.test(path.extname(item.path)) ||
          path.extname(item.path) == ".ass")
      ) {
        let houZhui = null;
        if (path.extname(item.path) == ".mkv") {
          houZhui = ".mkv";
        }
        if (path.extname(item.path) == ".mp4") {
          houZhui = ".mp4";
        }
        if (path.extname(item.path) == ".ass") {
          if (/sc|SC|chs|CHS/.test(path.basename(item.path))) {
            houZhui = ".zh-CN.ass";
          }
          if (/tc|TC|cht|CHT/.test(path.basename(item.path))) {
            houZhui = ".zh-TW.ass";
          }
        }
        // 集数提取
        if (new RegExp("\\d{2}\\(\\d{2}\\)").test(path.basename(item.path))) {
          let episodeNum = path
            .basename(item.path)
            .match(/\[(\d+)\(\d+\)\]/)
            .join()
            .slice(1, 3);
          tvReNameFn(
            item.path,
            `${new_file_path}\\Season ${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
          );
          // return;
        }
        if (/\[(0[0-9]|[1-9][0-9])\]/.test(path.basename(item.path))) {
          let episodeNum = path
            .basename(item.path)
            .match(/\[(0[0-9]|[1-9][0-9])\]/g)
            .join()
            .slice(1, 3);
          tvReNameFn(
            item.path,
            `${new_file_path}\\Season ${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
          );
          // return;
        }
      }
    }
    // SPs 分类处理
    if (subtitles == "jsum") {
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
      if (path.extname(item.path) == ".rar") {
        if (!fs.existsSync(`${old_file_path}\\${name} CDs`)) {
          fs.mkdir(`${old_file_path}\\${name} CDs`, (err) => {});
        }
      }
    }
    if (
      item.type == "Folder" &&
      (path.basename(item.path) == "SPs" || path.basename(item.path) == "Bonus")
    ) {
      if (!fs.existsSync(`${old_file_path}\\${name} CDs`)) {
        fs.mkdir(`${old_file_path}\\${name} CDs`, (err) => {});
      }
      item.sonFolder.forEach((twoItem) => {
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
  });
}

// 电影分类整理移动
// 需求：对文件夹内的文件进行分类重命名并下载其封面
// 参数需求：名字\文件原路径、字幕组\压制组名字、封面下载
// 文件新路径

async function movieSortTidyFn(
  movie_name,
  old_file_path,
  subtitles,
  poster_path
) {
  // 文件新路径
  let new_file_path = New_dir_path.concat(`${movie_name}`);

  // 判断新路径是否存在
  if (!fs.existsSync(new_file_path)) {
    fs.mkdir(new_file_path, (err) => {
      // console.log(new_file_path + ":创建失败", err);
    });
  }
  // // infuse封面
  downloadImageFn(poster_path, new_file_path);

  let fileTree = get_Dir_treeArrFn(old_file_path);
  let resolution = null;
  let hdr = null;
  let DoVi = null;
  fileTree.forEach((item) => {
    // 分类文件夹创建
    folderFountFn("movie", new_file_path, 1);
    // 电影重命名及版本区分
    if (subtitles == "jsum") {
      if (item.type == "file" && /JPN/i.test(path.basename(item.path))) {
        let movie_new_path = `${new_file_path}\\${movie_name} - 1080p - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
    }
    if (
      item.type == "file" &&
      /1080p|1080P/.test(path.basename(item.path)) &&
      (path.extname(item.path) == ".mkv" ||
        path.extname(item.path) == ".ass") &&
      subtitles != "jsum"
    ) {
      resolution = "1080p";
      if (path.extname(item.path) == ".mkv") {
        let movie_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /sc|SC|chs|CHS/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.zh-CN.ass`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.zh-TW.ass`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
    }
    if (
      item.type == "file" &&
      /2160p|2160P/.test(path.basename(item.path)) &&
      (path.extname(item.path) == ".mkv" ||
        path.extname(item.path) == ".ass") &&
      subtitles != "jsum"
    ) {
      resolution = "2160p";
      if (path.extname(item.path) == ".mkv") {
        let movie_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /sc|SC|chs|CHS/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.zh-CN.mkv`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.zh-TW.mkv`;
        movieReNameFn(item.path, movie_sub_new_path);
      }

      if (
        /HDR/.test(path.basename(item.path)) &&
        path.extname(item.path) == ".mkv"
      ) {
        hdr = "HDR";
        let movie_new_path = `${new_file_path}\\${movie_name} - ${resolution}.${hdr} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }

      if (
        /DV|DoVi/.test(path.basename(item.path)) &&
        path.extname(item.path) == ".mkv"
      ) {
        DoVi = "DoVi";
        let movie_new_path = `${new_file_path}\\${movie_name} - ${resolution}.${DoVi} - ${subtitles}.mkv`;
        movieReNameFn(item.path, movie_new_path);
      }
    }
    // 特典分类整理
    if (subtitles == "jsum") {
      if (item.type == "file" && path.extname(item.path) == ".mkv") {
        if (SpKeyWords.Others.test(item.path)) {
          let movie_sp_new_path = `${new_file_path}\\Extras\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Others
          )}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
        if (SpKeyWords.Trailers.test(item.path)) {
          let movie_sp_new_path = `${new_file_path}\\Trailers\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Trailers
          )}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
        if (SpKeyWords.Interviews.test(item.path)) {
          let movie_sp_new_path = `${new_file_path}\\Interviews\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Interviews
          )}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
      }
      if (path.extname(item.path) == ".rar") {
        if (!fs.existsSync(`${old_file_path}\\${movie_name} CDs`)) {
          fs.mkdir(`${old_file_path}\\${movie_name} CDs`, (err) => {});
        }
      }
    }
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
      if (!fs.existsSync(`${old_file_path}\\${movie_name} CDs`)) {
        fs.mkdir(`${old_file_path}\\${movie_name} CDs`, (err) => {});
      }
      item.sonFolder.forEach((twoItem) => {
        if (
          SpKeyWords.Others.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Extras\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Others
          )}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Trailers.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Trailers\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Trailers
          )}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Interviews.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Interviews\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Interviews
          )}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
      });
    }
  });
}

// 创建分类文件夹
function folderFountFn(keyWords, pathName, seasonNum) {
  if (keyWords != "movie") {
    if (!fs.existsSync(`${pathName}\\Season ${seasonNum}`)) {
      fs.mkdir(`${pathName}\\Season ${seasonNum}`, (err) => {});
    }
    // if (!fs.existsSync(`${pathName}\\CDs\\Season ${seasonNum}`)) {
    //   fs.mkdir(`${pathName}\\CDs\\Season ${seasonNum}`, (err) => {});
    // }
  } else {
    // if (!fs.existsSync(`${pathName}\\CDs`)) {
    //   fs.mkdir(`${pathName}\\CDs`, (err) => {});
    // }
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
  // if (!fs.existsSync(`${pathName}\\CDs`)) {
  //   fs.mkdir(`${pathName}\\CDs`, (err) => {});
  // }
}

// TV集数重命名
function tvReNameFn(oldPath, newPath) {
  fs.rename(oldPath, newPath, (err) => {
    if (err != null) console.log(oldPath, "TV重命名失败：", err);
  });
}
``;
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
  };
}

async function tv_search_resultsFn(anime_name) {
  anime_name = anime_name.replace(/ /g, "%20");
  let tv_search_api = `https://api.themoviedb.org/3/search/tv?query=${anime_name}&language=en-US&page=1`;
  let tv_search_results = await fetch(tv_search_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log(anime_name + "ID请求错误", err));
  return tv_search_results;
}

async function tvDetailsFn(tv_ID) {
  let tv_Details_api = `https://api.themoviedb.org/3/tv/${tv_ID}?language=zh-CN'`;
  let anime_tv_Details = await fetch(tv_Details_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log(anime_name + "详情请求错误", err));
  return anime_tv_Details;
}

async function tv_alternative_titlesFn(
  tvDetailsArr,
  animeName,
  season_number,
  episode_num
) {
  let tv_ID = null;
  for (let i = 0; i < tvDetailsArr.length; i++) {
    let tv_alternative_titles_api = `https://api.themoviedb.org/3/tv/${tvDetailsArr[i].id}/alternative_titles`;
    let titles = await fetch(tv_alternative_titles_api, getParams)
      .then((res) => res.json())
      .then((json) => json)
      .catch((err) => console.error("error:" + err));
    let animeDetails = await tvDetailsFn(tvDetailsArr[i].id);
    // console.log(titles.results);
    for (let k = 0; k < titles.results.length; k++) {
      if (tv_ID != null) break;
      if (new RegExp(animeName, "i").test(titles.results[k].title)) {
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
  return tv_ID;
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

let dir_treeArr = get_Dir_treeArrFn(DirectoryPath);
anime_discernFn(dir_treeArr);
