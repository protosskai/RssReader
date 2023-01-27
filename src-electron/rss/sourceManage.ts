/**
 * 管理订阅源相关
 * 新增或删除订阅源。并且负责持久化到存储中
 */
import {OpmlOutline, OpmlObject} from "./opmlUtil";
import {readOpmlFromFile, dumpOpmlToFile} from "./opmlUtil";
import {promises as fs} from "fs";
import {buildAvatarUrl} from "app/src-electron/rss/utils";

export const DEFAULT_FOLDER = "__rss_client_default__";

export class Source {
  url: string;
  name: string = "";
  folder: string = "";
  avatar: string = "";
  htmlUrl: string = "";

  constructor(url: string, name?: string, folder?: string, avatar?: string, htmlUrl?: string) {
    this.url = url;
    if (name) {
      this.name = name;
    }
    if (folder) {
      this.folder = folder;
    }
    if (avatar) {
      this.avatar = avatar
    }
    if (htmlUrl) {
      this.htmlUrl = htmlUrl
    }
  }
}

export class Folder {
  name: string;
  sourceArray: Source[] = [];

  constructor(name: string) {
    this.name = name;
  }

  addSource(url: string): void;
  addSource(source: Source): void;
  addSource(value: string | Source): void {
    let source: Source;
    if (typeof value === "string") {
      source = new Source(value);
    } else {
      source = value;
    }
    source.folder = this.name;
    this.sourceArray.push(source);
  }

  removeSource(name: string): void;
  removeSource(index: number): void;
  removeSource(source: Source): void;
  removeSource(value: string | number | Source): void {
    if (typeof value === "string") {
      const index = this.sourceArray.findIndex(source => source.name === value);
      if (index === -1) {
        throw new Error(`source of name 【${value}】not exists!`);
      }
      this.sourceArray.splice(index, 1);
    } else if (typeof value === "number") {
      if (value >= this.sourceArray.length) {
        throw new Error(`index of sourceArray 【${value}】is out of range!`);
      }
      this.sourceArray.splice(value, 1);
    } else {
      const index = this.sourceArray.findIndex(source => source.name === value.name);
      if (index === -1) {
        throw new Error(`source of name 【${value.name}】is not in sourceArray!`);
      }
      this.sourceArray.splice(index, 1);
    }
  }
}

export class SourceManage {
  folderMap: Record<string, Folder | null> = {};
  static instance: SourceManage | null = null

  constructor() {
    this.init();
  }

  static getInstance(): SourceManage {
    if (SourceManage.instance === null) {
      SourceManage.instance = new SourceManage()
    }
    return SourceManage.instance
  }

  init() {
    this.folderMap = {
      [DEFAULT_FOLDER]: new Folder(DEFAULT_FOLDER)
    };
  }

  addFolder(folder: Folder): void;
  addFolder(name: string): void;
  addFolder(value: string | Folder): void {
    if (typeof value === "string") {
      this.folderMap[value] = new Folder(value);
    } else {
      this.folderMap[value.name] = value;
    }
  }

  getFolder(name: string): Folder | null {
    return this.folderMap[name];
  }

  getDefaultFolder(): Folder {
    return this.folderMap[DEFAULT_FOLDER]!;
  }

  deleteFolder(name: string): void;
  deleteFolder(folder: Folder): void;
  deleteFolder(value: string | Folder): void {
    if (typeof value === "string") {
      if (!this.folderMap[value]) {
        throw new Error(`folder 【${value}】 not exist!`);
      }
      delete this.folderMap[value];
    } else {
      delete this.folderMap[value.name];
    }
  }

  dump(): OpmlObject {
    const opmlObject = new OpmlObject();
    opmlObject.title = "feedOpml";
    Object.keys(this.folderMap).forEach(folderName => {
      const sourceArray = this.folderMap[folderName]!.sourceArray;
      const outline = new OpmlOutline();
      if (folderName !== DEFAULT_FOLDER) {
        outline.text = folderName;
        outline.title = folderName;
        sourceArray.forEach(item => {
          const subOutline = new OpmlOutline(item.name, item.name, [], "rss", item.url, item.url);
          outline.addOutline(subOutline);
        });
        opmlObject.addOutline(outline);
      } else {
        const outline = new OpmlOutline();
        outline.text = DEFAULT_FOLDER
        outline.title = DEFAULT_FOLDER
        sourceArray.forEach(item => {
          const subOutline = new OpmlOutline(item.name, item.name, [], "rss", item.url, item.url);
          outline.addOutline(subOutline);
        });
        opmlObject.addOutline(outline)
      }
    });
    return opmlObject;
  }

  private convertOutlineToSource(outline: OpmlOutline, folder?: Folder): Source {
    const url = outline.getUrl();
    const name = outline.getName();
    let htmlUrl: string = "";
    let avatarUrl: string = "";
    if (outline.htmlUrl) {
      htmlUrl = outline.htmlUrl
      avatarUrl = buildAvatarUrl(htmlUrl)
    }
    const source = new Source(url, name, undefined, avatarUrl, htmlUrl);
    if (folder) {
      source.folder = folder.name;
    }
    return source;
  }

  load(opmlObject: OpmlObject) {
    this.init();
    const outlines = opmlObject.outline;
    outlines.forEach(item => {
      if (item.type === "rss") {
        // 根目录的rss节点直接挂载默认目录里面
        const source = this.convertOutlineToSource(item, this.folderMap[DEFAULT_FOLDER]!);
        this.folderMap[DEFAULT_FOLDER]!.sourceArray.push(source);
      } else {
        this.folderMap[item.getName()] = new Folder(item.getName());
        item.subOutlines.forEach(subItem => {
          const source = this.convertOutlineToSource(subItem, this.folderMap[item.getName()]!);
          this.folderMap[item.getName()]!.sourceArray.push(source);
        });
      }
    });
  }

  async loadFromFile(filename: string) {
    const opmlObject = await readOpmlFromFile(filename);
    this.load(opmlObject);
  }

  async saveToFile(filename: string) {
    const opmlObject = this.dump();
    await dumpOpmlToFile(opmlObject, filename);
  }

  private async isDirectory(filePath: string) {
    return await fs.stat(filePath).then(stat => stat.isDirectory()).catch(_ => false)
  }

  private async isFile(filePath: string) {
    return await fs.stat(filePath).then(stat => stat.isFile()).catch(_ => false)
  }


  private async writeFile(path: string, data: string) {
    return await fs.writeFile(path, data, {flag: 'a'})
  }

  private async createDefaultOpmlFile(path: string) {
    const template = `<?xml version="1.0" encoding="UTF-8"?>
                      <opml version="1.1">
                        <head>
                          <title>Subscriptions-OnMyMac.opml</title>
                        </head>
                        <body>
                        </body>
                      </opml>`
    await this.writeFile(path, template)
  }

  private async getDefaultConfigFilePath(): Promise<string> {
    const user_home = process.env.HOME || process.env.USERPROFILE
    const defaultConfigDir = `${user_home}/RssClient`
    if (!await this.isDirectory(defaultConfigDir)) {
      await fs.mkdir(defaultConfigDir)
    }
    const defaultConfigFilePath = `${user_home}/RssClient/_default.opml`
    if (!await this.isFile(defaultConfigFilePath)) {
      await this.createDefaultOpmlFile(defaultConfigFilePath)
    }
    return defaultConfigFilePath
  }

  async loadDefaultConfigFile() {
    const defaultPath = await this.getDefaultConfigFilePath()
    await this.loadFromFile(defaultPath)
  }

  async dumpToDefaultConfigFile() {
    const defaultPath = await this.getDefaultConfigFilePath()
    await this.saveToFile(defaultPath)
  }
}
