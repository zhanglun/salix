import fs from 'fs';
import path from 'path';
import { ipcMain, ipcRenderer, remote } from 'electron';
import log from 'electron-log';
import { getCustomRepository } from 'typeorm';
import { ChannelEntity } from '../entity/channel';
import { ChannelRepository } from '../repository/channel';
import { ArticleRepository } from '../repository/article';
import {
  SUBSCRIBE,
  FINISH_INITIAL_SYNC,
  MANUAL_SYNC_UNREAD,
  FINISH_MANUAL_SYNC_UNREAD,
  EXPORT_OPML,
  FINISH_EXPORT_OPML,
  IMPORT_OPML,
  FINISH_IMPORT_OPML,
  PROXY_GET_CHANNEL_LIST,
  PROXY_GET_ARTICLE_LSIT,
} from './constant';
import { parseRSS } from '../infra/utils';
import { Channel, RSSFeedItem } from '../infra/types';

type OPMLItem = { title: string; feedUrl: string };

export const initEvent = () => {
  const channelRepo: ChannelRepository = getCustomRepository(ChannelRepository);
  const articleRepo: ArticleRepository = getCustomRepository(ArticleRepository);

  function singleFetch(
    requestList: Promise<{ items: RSSFeedItem[] }>[],
    idList: string[],
    index = 0
  ) {
    let timer: any = null;
    let count = index;

    if (!requestList[index]) {
      log.info('同步结束');
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      requestList[count]
        .then((res) => {
          log.info('请求完成', count);
          count += 1;
          requestList.unshift();
          singleFetch(requestList, idList, count);
          return articleRepo.insertArticles(idList[index], res.items);
        })
        .catch((err) => {
          count += 1;
          requestList.unshift();
          log.info(err);
        });
    }, 1000);
  }

  /**
   * 批量同步文章
   */
  async function batchSyncArticles() {
    const channelList = await channelRepo.getList();
    const channelIdList: string[] = [];
    const requestList: Promise<any>[] = [];
    channelList.forEach((channel) => {
      const { feedUrl, id } = channel;
      requestList.push(parseRSS(feedUrl));
      channelIdList.push(id);
    });
    singleFetch(requestList, channelIdList, 0);
  }

  function syncUnreadWhenAPPStart() {
    channelRepo
      .getList()
      .then((list) => {
        ipcRenderer.send(FINISH_INITIAL_SYNC, list);
        return list;
      })
      .catch((err) => {
        return err;
      });
  }

  /**
   * 手动更新
   */
  async function syncUnreadManually() {
    log.info('手动同步，创建任务更新数据');
    await batchSyncArticles();
    ipcRenderer.send(FINISH_MANUAL_SYNC_UNREAD);
  }

  async function exportOPMLFile() {
    // const channels = await channelStore.getList();
    // let $xml = '<xml xmlns="http://www.w3.org/1999/xhtml">';
    // let $opml = '<opml version="1.0">';
    // channels.forEach((channel) => {
    //   $opml += `\n    <outline type="rss" text="${channel.title}" title="${channel.title}" xmlUrl="${channel.feedUrl}" htmlUrl="${channel.link}"/>\n`;
    // });
    // $xml += $opml;
    // $xml += '</opml></xml>';
    // const downloadPath = remote.app.getPath('downloads');
    // let filename = path.resolve(downloadPath, 'salix.opml');
    // filename =
    //   remote.dialog.showSaveDialogSync({
    //     title: 'Export OPML',
    //     defaultPath: filename,
    //   }) || filename;
    // log.info('开始导出OPML', filename);
    // fs.writeFileSync(filename, $xml);
  }

  /**
   * 导入 OPML
   */
  async function importFeed(item: OPMLItem) {
    const { feedUrl } = item;

    console.log('开始加载 ->', feedUrl);

    const channel = await channelRepo.getOneByUrl(feedUrl);

    if (channel) {
      return false;
    }

    try {
      const channelRes = await parseRSS(feedUrl);
      const { items } = channelRes;
      await channelRepo.subscribeChannel(channelRes as Channel);

      // TODO: 插入文章

      console.log('加载成功 -<', feedUrl);
      return true;
    } catch (err) {
      console.error('Err', err);
      console.log('加载失败 -<', feedUrl);
      return false;
    }
  }

  async function batchImportFeeds(items: OPMLItem[]) {
    const requestList = items.map((item) => {
      return importFeed(item);
    });

    Promise.allSettled(requestList)
      .then((a) => a)
      .catch(() => {});
  }

  /**
   * 手动同步未读文章
   */
  ipcMain.on(MANUAL_SYNC_UNREAD, async () => {
    console.log('----> MANUAL_SYNC_UNREAD');
    await syncUnreadManually();
  });

  /**
   * 导出 OPML
   */
  ipcMain.on(EXPORT_OPML, async (event) => {
    await exportOPMLFile();
    event.reply(FINISH_EXPORT_OPML);
  });

  ipcMain.on(IMPORT_OPML, async (event, list: OPMLItem[]) => {
    try {
      log.info('后台开始批量导入订阅', list);
      await batchImportFeeds(list);
      event.reply(IMPORT_OPML, {
        status: 'success',
      });
    } catch (err) {
      event.reply(IMPORT_OPML, {
        status: 'error',
        message: err.message,
        err,
      });
    }
  });

  ipcMain.on(SUBSCRIBE, async (event, data) => {
    try {
      const { items = [] } = data;
      const result = await channelRepo.addOne(data as Channel);
      await articleRepo.insertArticles(result.id, items);

      event.reply(SUBSCRIBE, {
        status: 'success',
      });
    } catch (err) {
      event.reply(SUBSCRIBE, {
        status: 'error',
        message: err.message,
        err,
      });
    }
  });

  ipcMain.on(PROXY_GET_CHANNEL_LIST, async (event) => {
    const result = await channelRepo.getAll();

    event.reply(PROXY_GET_CHANNEL_LIST, result);
  });

  ipcMain.on(PROXY_GET_ARTICLE_LSIT, async (event) => {
    const result = await articleRepo.getAllArticle();

    event.reply(PROXY_GET_ARTICLE_LSIT, result);
  });

  syncUnreadWhenAPPStart();
};
