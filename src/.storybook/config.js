import {configure} from '@storybook/react';
import 'bootstrap/dist/css/bootstrap.min.css';

const req = require.context('../browser/components', true, /\.stories\.jsx$/)

function loadStories() {
  req.keys().forEach((filename) => req(filename))
}

configure(loadStories, module);
