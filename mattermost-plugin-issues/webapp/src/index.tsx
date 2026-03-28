// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from './manifest';
import reducer from './reducers';
import client from './client/client';
import ActionTypes from './actions/action_types';
import {fetchProjects} from './actions';

import RHSView from './components/rhs/rhs_view';
import CreateIssueModal from './components/create_issue_modal/create_issue_modal';
import SidebarHeader from './components/sidebar_header/sidebar_header';

import './styles/main.scss';

type Store = {dispatch: (action: any) => void; getState: () => any};
type PluginRegistry = {
    registerReducer: (reducer: any) => void;
    registerRightHandSidebarComponent: (component: any, title: string) => any;
    registerChannelHeaderButtonAction: (icon: any, action: () => void, dropdownText: string, tooltipText: string) => void;
    registerLeftSidebarHeaderComponent: (component: any) => void;
    registerRootComponent: (component: any) => void;
    registerWebSocketEventHandler: (event: string, handler: (msg: any) => void) => void;
};

// Channel header icon as a simple React component.
function IssuesIcon() {
    return (
        <span style={{fontSize: '16px', lineHeight: 1}}>{'📋'}</span>
    );
}

class Plugin {
    public async initialize(registry: PluginRegistry, store: Store) {
        // Set up API client.
        const basename = (window as any).basename || '';
        client.setServerRoute(basename);

        // Register Redux reducer for plugin state.
        registry.registerReducer(reducer);

        // Register the RHS (Right-Hand Sidebar) panel.
        // The return value contains action creators that must be dispatched.
        const rhsRegistration = registry.registerRightHandSidebarComponent(
            RHSView,
            'Issues',
        );

        // Store the toggle action — could be toggleRHSPlugin or showRHSPlugin depending on MM version.
        const toggleAction = rhsRegistration.toggleRHSPlugin || rhsRegistration.showRHSPlugin;

        // Register channel header button to toggle the RHS.
        registry.registerChannelHeaderButtonAction(
            IssuesIcon,
            () => {
                if (toggleAction) {
                    store.dispatch(toggleAction);
                }
            },
            'Issues',
            'Toggle Issues Tracker',
        );

        // Register the create/edit issue modal (rendered globally).
        registry.registerRootComponent(CreateIssueModal);

        // Register left sidebar header component.
        registry.registerLeftSidebarHeaderComponent(SidebarHeader);

        // Register WebSocket handlers for real-time updates.
        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_issue_created`,
            (msg: any) => {
                try {
                    const issue = JSON.parse(msg.data.issue);
                    store.dispatch({type: ActionTypes.RECEIVED_ISSUE, data: issue});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_issue_updated`,
            (msg: any) => {
                try {
                    const issue = JSON.parse(msg.data.issue);
                    store.dispatch({type: ActionTypes.RECEIVED_ISSUE, data: issue});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_issue_deleted`,
            (msg: any) => {
                const id = msg.data.id;
                if (id) {
                    store.dispatch({type: ActionTypes.ISSUE_DELETED, data: id});
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_label_created`,
            (msg: any) => {
                try {
                    const label = JSON.parse(msg.data.label);
                    store.dispatch({type: ActionTypes.RECEIVED_LABEL, data: label});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_label_updated`,
            (msg: any) => {
                try {
                    const label = JSON.parse(msg.data.label);
                    store.dispatch({type: ActionTypes.RECEIVED_LABEL, data: label});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_label_deleted`,
            (msg: any) => {
                const id = msg.data.id;
                if (id) {
                    store.dispatch({type: ActionTypes.LABEL_DELETED, data: id});
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_cycle_created`,
            (msg: any) => {
                try {
                    const cycle = JSON.parse(msg.data.cycle);
                    store.dispatch({type: ActionTypes.RECEIVED_CYCLE, data: cycle});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_cycle_updated`,
            (msg: any) => {
                try {
                    const cycle = JSON.parse(msg.data.cycle);
                    store.dispatch({type: ActionTypes.RECEIVED_CYCLE, data: cycle});
                } catch (e) {
                    // Ignore parse errors.
                }
            },
        );

        registry.registerWebSocketEventHandler(
            `custom_${manifest.id}_cycle_deleted`,
            (msg: any) => {
                const id = msg.data.id;
                if (id) {
                    store.dispatch({type: ActionTypes.CYCLE_DELETED, data: id});
                }
            },
        );

        // Fetch initial data.
        try {
            await store.dispatch(fetchProjects() as any);
        } catch (e) {
            console.error('[Issues Plugin] Error fetching initial projects:', e);
        }
    }
}

(window as any).registerPlugin(manifest.id, new Plugin());
