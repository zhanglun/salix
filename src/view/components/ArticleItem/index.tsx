import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../Icon';
import { ArticleReadStatus } from '../../../infra/constants/status';
import { Article } from '../../../infra/types';
import styles from './articleitem.css';

type ArticleItemProps = {
  article: Article;
};

export const ArticleItem = (props: ArticleItemProps) => {
  const { article } = props;
  const [expand, setExpand] = useState(false);
  const handleClick = useCallback(() => {
    setExpand(!expand);
  }, [expand]);

  return (
    <li
      className={`${styles.item} ${
        article.hasRead === ArticleReadStatus.isRead && styles.read
      } ${expand && styles.expand}`}
      onClick={handleClick}
      aria-hidden="true"
    >
      <div className={styles.header}>
        <div className={styles.title}>{article.title}</div>
        <div className={styles.actions}>
          <Icon customClass={styles.icon} name="bookmark_add" />
          <Icon customClass={styles.icon} name="favorite_border" />
          <Icon customClass={styles.icon} name="done" />
          <Icon customClass={styles.icon} name="launch" />
        </div>
      </div>
      <div
        className={styles.content}
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
      {/* <div className={styles.meta}>
        <span className={styles.channel}>{article.channelTitle}</span>
        <span className={styles.pubTime}>
          {Dayjs(article.pubDate).format('YYYY-MM-DD HH:mm')}
        </span>
      </div> */}
    </li>
  );
};
