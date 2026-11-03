import { mount } from 'svelte';
import { App } from '@oberstufen-planer/ui';
import { platform, wireNative } from './lib/platform.ts';

mount(App, { target: document.getElementById('app')!, props: { platform } });
wireNative();
