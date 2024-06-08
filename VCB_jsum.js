import fs from "fs";
import path, { extname } from "path";
import fetch from "node-fetch";
import fsExtra from "fs-extra";
// TMDB API访问令牌
const Authorization =
  "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmM3NjE3MGM0MzRjMDg1OTBjZmRiOWZhZDQ2NGFmMyIsInN1YiI6IjY0NjM2NzljMGYzNjU1MDBmY2RmZGM3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.40wlnzIDZdXUMyBbl2lonctJqDw62KhrfIGXP9XeziY";
// 指定识别位置
const DirectoryPath = "G:\\115 Downloads";
// 指定生成位置
const New_dir_path = "G:\\115_Downloads\\";
// 特典关键词
const SpKeyWords = {
  Trailers: /promotion|PV|character Pv|CM|Preview|Trailer|Teaser/,
  Others: /NCED|NCOP|OP|ED|Menu|menu|MV|Easter Egg/i,
  Interviews: /IV|Making/,
};
const SubKeyWords = {
  sub: /VCB-Studio|VCB-S|jsum/,
  video_params: /1080p|x264|x265|HEVC|AVC|H264|H265|Hi10p|BDrip|SP/i,
};
const YearReg = /\b\d{4}\b/g;

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
      if (subtitles.category == "TV") {
        let episode_num = tvEpisodeFn(item);

        let anime_tv = await tmdb_TV_requestFn(
          subtitles.name,
          subtitles.season_number,
          episode_num
        );

        if (anime_tv.chinaName != "" && anime_tv.chinaName != "undefined") {
          await tvSortTidyFn(
            anime_tv.chinaName,
            item.path,
            subtitles.subtitles,
            anime_tv.poster_path,
            anime_tv.season_number
          );
        }
      }
      if (subtitles.category == "movie") {
        let anime_movie = await tmdb_movie_requestFn(subtitles.name);
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
      } else {
        if (category_discern === null) category_discern = "TV";
      }
      // []全包裹下，使用第二[]包裹的内容作为识别名字
      if (!(SubKeyWords.video_params.test(item) && index != 0)) {
        prototype_name = item.slice(1, -1);
        name = item.slice(1, -1);
        // 季节判断
        if (/\b(10|[1-9])\b/g.test(item) && category_discern == "TV") {
          // console.log(item);
          prototype_name = item;
          name = item.repeat(/\b(10|[1-9])\b/g, "").trim();
          season_number = item.match(/\b(10|[1-9])\b/g).join("");
        }
        if (
          /\b(S\d+|Season\s?\d+)\b/gi.test(item) &&
          category_discern == "TV"
        ) {
          // console.log(item);
          prototype_name = item;
          name = item.repeat(/\b(S\d+|Season\s?\d+)\b/gi, "").trim();
          season_number = item.match(/\d+/).join("");
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
    get_Dir_treeArrFn(path_name).forEach((item) => {
      if (item.type == "file" && path.extname(item.path) == ".mkv") m++;
    });
    name = path.basename(path_name).replace(/\[([^\]]+)\]/g, "");
    prototype_name = name;
    let pathNameCJ = path.basename(path_name).match(/\[.*?\]/g) || [];
    pathNameCJ.push(name);
    if (SubKeyWords.sub.test(pathNameCJ[0])) {
      subtitles = pathNameCJ[0].match(SubKeyWords.sub).join("");
    }
    pathNameCJ.forEach((item, index) => {
      if (/movie/i.test(item) || m < 2) {
        category_discern = "movie";
      } else {
        if (category_discern === null) category_discern = "TV";
      }
      if (/\b(10|[1-9])\b/g.test(item) && category_discern == "TV") {
        // console.log(item);
        prototype_name = item;
        name = item.replace(/\b(10|[1-9])\b/g, "").trim();
        season_number = item.match(/\b(10|[1-9])\b/g).join("");
      }
      if (/\b(S\d+|Season\s?\d+)\b/gi.test(item) && category_discern == "TV") {
        prototype_name = item;
        name = item.replace(/\b(S\d+|Season\s?\d+)\b/gi, "").trim();
        season_number = item.match(/\d+/).join("");
      }
    });
  }
  // console.log("   ");
  // console.log(
  //   `字幕组：${subtitles} 提取名字：${name} 识别类型：${category_discern} 季节：${season_number} 原名：${prototype_name}`
  // );
  return {
    subtitles,
    name: name.trim(),
    category: category_discern,
    prototype_name,
    season_number,
  };
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
        // 集数提取
        let episodeNum = path
          .basename(item.path)
          .match(/\[(0[0-9]|[1-9][0-9])\]/g)
          .join()
          .slice(1, 3);
        tvReNameFn(
          item.path,
          `${new_file_path}\\Season ${season_number}\\${name} - S0${season_number}E${episodeNum} - ${subtitles}${houZhui}`
        );
      }
      // 识别集数为.5的
      // if(/\[[^\]]*\.5[^\]]*\]/.test(path.basename(item.path)))
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
            `${new_file_path}\\Trailers\\${new_SP_Name} - ${subtitles}.mkv`
          );
        }
        if (SpKeyWords.Others.test(path.basename(item.path))) {
          let new_SP_Name = fileSPsReNameFn({
            keyWords: SpKeyWords.Others,
            seasonNum: season_number,
            chinaName: name,
            path: item.path,
          });
          tvReNameFn(
            item.path,
            `${new_file_path}\\Others\\${new_SP_Name} - ${subtitles}.mkv`
          );
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
            `${new_file_path}\\Interviews\\${new_SP_Name} - ${subtitles}.mkv`
          );
        }
      }
    }
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
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
            `${new_file_path}\\Others\\${new_SP_Name} - ${subtitles}.mkv`
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
            `${new_file_path}\\Trailers\\${new_SP_Name} - ${subtitles}.mkv`
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
            `${new_file_path}\\Interviews\\${new_SP_Name} - ${subtitles}.mkv`
          );
        }
      });
    }
    // if (item.type == "Folder" && /CDs/.test(item.path)) {
    //   tvReNameFn(
    //     item.path,
    //     `${newNamePath}\\CDs\\Season ${tvObj.seasonNum}\\CDs`
    //   );
    // }
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
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.chs.ass`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.cht.ass`;
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
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.chs.mkv`;
        movieReNameFn(item.path, movie_sub_new_path);
      }
      if (
        path.extname(item.path) == ".ass" &&
        /tc|TC|cht|CHT/.test(path.basename(item.path))
      ) {
        let movie_sub_new_path = `${new_file_path}\\${movie_name} - ${resolution} - ${subtitles}.cht.mkv`;
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
          let movie_sp_new_path = `${new_file_path}\\Others\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Others
          )} - ${subtitles}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
        if (SpKeyWords.Trailers.test(item.path)) {
          let movie_sp_new_path = `${new_file_path}\\Trailers\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Trailers
          )} - ${subtitles}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
        if (SpKeyWords.Interviews.test(item.path)) {
          let movie_sp_new_path = `${new_file_path}\\Interviews\\${movie_name} ${movieSpNameFn(
            item.path,
            SpKeyWords.Interviews
          )} - ${subtitles}.mkv`;
          movieReNameFn(item.path, movie_sp_new_path);
        }
      }
    }
    if (item.type == "Folder" && path.basename(item.path) == "SPs") {
      item.sonFolder.forEach((twoItem) => {
        if (
          SpKeyWords.Others.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Others\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Others
          )} - ${subtitles}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Trailers.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Trailers\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Trailers
          )} - ${subtitles}.mkv`;
          movieReNameFn(twoItem.path, movie_sp_new_path);
        }
        if (
          SpKeyWords.Interviews.test(twoItem.path) &&
          path.extname(twoItem.path) == ".mkv"
        ) {
          let movie_sp_new_path = `${new_file_path}\\Interviews\\${movie_name} ${movieSpNameFn(
            twoItem.path,
            SpKeyWords.Interviews
          )} - ${subtitles}.mkv`;
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
    if (!fs.existsSync(`${pathName}\\CDs\\Season ${seasonNum}`)) {
      fs.mkdir(`${pathName}\\CDs\\Season ${seasonNum}`, (err) => {});
    }
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
  if (!fs.existsSync(`${pathName}\\Others`)) {
    fs.mkdir(`${pathName}\\Others`, (err) => {});
  }
  // if (!fs.existsSync(`${pathName}\\CDs`)) {
  //   fs.mkdir(`${pathName}\\CDs`, (err) => {});
  // }
}

// 集数识别
function tvEpisodeFn(VcbEObj) {
  let num = 0;
  VcbEObj.sonFolder.forEach((item) => {
    if (
      item.type == "file" &&
      path.extname(item.path) == ".mkv" &&
      /\[(0[0-9]|[1-9][0-9])\]/.test(path.basename(item.path))
    ) {
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
    }
  }
  return newName;
}

// TMDB请求
async function tmdb_movie_requestFn(movie_name) {
  let chinaName = "";
  let poster_path = "";
  let getParams = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: Authorization,
    },
  };
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

async function tmdb_TV_requestFn(anime_name, season_num, episode_num) {
  // 需要季数、名字、集数
  // 要返回的数据 中文名称、季数
  let chinaName = "";
  let chinaSeasonName = "";
  let season_number = 1;
  let poster_path = "";
  let getParams = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: Authorization,
    },
  };
  anime_name = anime_name.replace(/ /g, "%20");
  let tv_search_api = `https://api.themoviedb.org/3/search/tv?query=${anime_name}&language=en-US&page=1`;
  let tv_ID = await fetch(tv_search_api, getParams)
    .then((res) => res.json())
    .then((json) => json.results[0].id)
    .catch((err) => console.log(anime_name + "ID请求错误", err));
  let tv_Alternative_Titles_api = `https://api.themoviedb.org/3/tv/${tv_ID}/alternative_titles`;
  let tv_Details_api = `https://api.themoviedb.org/3/tv/${tv_ID}?language=zh-CN'`;
  let anime_tv_Details = await fetch(tv_Details_api, getParams)
    .then((res) => res.json())
    .then((json) => json)
    .catch((err) => console.log(anime_name + "详情请求错误", err));

  // 季数匹配
  let season_episode_count = 1;
  anime_tv_Details.seasons.forEach((item) => {
    // 集数识别
    if (item.episode_count == episode_num) {
      chinaName = anime_tv_Details.name;
      poster_path = anime_tv_Details.poster_path;
      if (item.season_number <= 1 && season_num == 1) {
        chinaSeasonName = item.name;
        season_number = item.season_number;
        season_episode_count = item.episode_count;
      }
      if (item.season_number == season_num) {
        chinaSeasonName = item.name;
        season_number = item.season_number;
        season_episode_count = item.episode_count;
      }
    } else {
      if (item.name != "特别篇") {
        console.log("   ");
        console.log(
          `${anime_name.replace(
            "%20",
            " "
          )}集数错误，请检查集数。本地集数：${episode_num},查询结果集数：${season_episode_count}。匹配中文名称：${
            anime_tv_Details.name
          }。当前识别为：第${season_number}季`
        );
      }
    }
  });
  console.log("   ");
  console.log("查询番剧名称：" + anime_name.replace(/%20/g, " "));
  console.log("匹配结果");
  console.log("TMDB_ID：" + tv_ID);
  console.log("中文名称：" + chinaName);
  console.log("中文季节名称：" + chinaSeasonName);
  console.log(
    "本季季数为：" + season_number,
    "本季集数：" + season_episode_count
  );
  return {
    details: anime_tv_Details,
    chinaName,
    season_number,
    poster_path,
  };
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
