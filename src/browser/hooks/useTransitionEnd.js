// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function useTransitionend(
  ref,
  callback,
  properties,
  listenForEventBubbling = true
) {
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    function handleTransitionEnd(event) {
      if (!listenForEventBubbling && event.target !== ref.current) {
        return;
      }

      if (properties && typeof properties === 'object') {
        const property = properties.find(
          (propertyName) => propertyName === event.propertyName
        );
        if (property) {
          callback(event);
        }
        return;
      }
      callback(event);
    }

    ref.current.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      if (!ref.current) {
        return;
      }
      ref.current.removeEventListener(
        'transitionend',
        handleTransitionEnd
      );
    };
  }, [ref, callback, properties, listenForEventBubbling]);
}

export default useTransitionend;
