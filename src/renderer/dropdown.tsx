// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {DraggingStyle, DropResult, NotDraggingStyle} from 'react-beautiful-dnd';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH_MAC} from 'common/utils/constants';

import type {UniqueServer} from 'types/config';

import './css/dropdown.scss';

import IntlProvider from './intl_provider';

type State = {
    servers?: UniqueServer[];
    serverOrder?: string[];
    orderedServers?: UniqueServer[];
    activeServer?: string;
    darkMode?: boolean;
    enableServerManagement?: boolean;
    unreads?: Map<string, boolean>;
    mentions?: Map<string, number>;
    expired?: Map<string, boolean>;
    hasGPOServers?: boolean;
    isAnyDragging: boolean;
    windowBounds?: Electron.Rectangle;
    nonce?: string;
}

function getStyle(style?: DraggingStyle | NotDraggingStyle) {
    if (style?.transform) {
        const axisLockY = `translate(0px${style.transform.slice(style.transform.indexOf(','), style.transform.length)}`;
        return {
            ...style,
            transform: axisLockY,
        };
    }
    return style;
}
class ServerDropdown extends React.PureComponent<Record<string, never>, State> {
    buttonRefs: Map<number, HTMLButtonElement>;
    addServerRef: React.RefObject<HTMLButtonElement>;
    focusedIndex: number | null;

    constructor(props: Record<string, never>) {
        super(props);
        this.state = {
            isAnyDragging: false,
        };
        this.focusedIndex = null;

        this.buttonRefs = new Map();
        this.addServerRef = React.createRef();

        window.desktop.serverDropdown.onUpdateServerDropdown(this.handleUpdate);
    }

    handleUpdate = (
        servers: UniqueServer[],
        darkMode: boolean,
        windowBounds: Electron.Rectangle,
        activeServer?: string,
        enableServerManagement?: boolean,
        hasGPOServers?: boolean,
        expired?: Map<string, boolean>,
        mentions?: Map<string, number>,
        unreads?: Map<string, boolean>,
    ) => {
        this.setState({
            servers,
            activeServer,
            darkMode,
            enableServerManagement,
            hasGPOServers,
            unreads,
            mentions,
            expired,
            windowBounds,
        });
    };

    selectServer = (server: UniqueServer) => {
        return () => {
            if (!server.id) {
                return;
            }
            window.desktop.serverDropdown.switchServer(server.id);
            this.closeMenu();
        };
    };

    closeMenu = () => {
        if (!this.state.isAnyDragging) {
            (document.activeElement as HTMLElement).blur();
            window.desktop.closeServersDropdown();
        }
    };

    preventPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    addServer = () => {
        window.desktop.serverDropdown.showNewServerModal();
        this.closeMenu();
    };

    isActiveServer = (server: UniqueServer) => {
        return server.id === this.state.activeServer;
    };

    onDragStart = () => {
        this.setState({isAnyDragging: true});
    };

    onDragEnd = (result: DropResult) => {
        const removedIndex = result.source.index;
        const addedIndex = result.destination?.index;
        if (addedIndex === undefined || removedIndex === addedIndex) {
            this.setState({isAnyDragging: false});
            return;
        }
        if (!this.state.servers) {
            throw new Error('No config');
        }
        const serversCopy = this.state.servers.concat();

        const server = serversCopy.splice(removedIndex, 1);
        const newOrder = addedIndex < this.state.servers.length ? addedIndex : this.state.servers.length - 1;
        serversCopy.splice(newOrder, 0, server[0]);

        this.setState({servers: serversCopy, isAnyDragging: false});
        window.desktop.updateServerOrder(serversCopy.map((server) => server.id!));
    };

    componentDidMount() {
        window.addEventListener('click', this.closeMenu);
        window.addEventListener('keydown', this.handleKeyboardShortcuts);
        window.desktop.getNonce().then((nonce) => {
            this.setState({nonce}, () => {
                window.desktop.serverDropdown.requestInfo();
            });
        });
    }

    componentDidUpdate() {
        window.desktop.serverDropdown.sendSize(document.body.scrollWidth, document.body.scrollHeight);
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.closeMenu);
        window.removeEventListener('keydown', this.handleKeyboardShortcuts);
    }

    setButtonRef = (serverIndex: number, refMethod?: (element: HTMLButtonElement) => unknown) => {
        return (ref: HTMLButtonElement) => {
            this.addButtonRef(serverIndex, ref);
            refMethod?.(ref);
        };
    };

    addButtonRef = (serverIndex: number, ref: HTMLButtonElement | null) => {
        if (ref) {
            this.buttonRefs.set(serverIndex, ref);
            ref.addEventListener('focusin', () => {
                this.focusedIndex = serverIndex;
            });
            ref.addEventListener('blur', () => {
                this.focusedIndex = null;
            });
        }
    };

    handleKeyboardShortcuts = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            if (this.focusedIndex === null) {
                this.focusedIndex = 0;
            } else {
                this.focusedIndex = (this.focusedIndex + 1) % this.buttonRefs.size;
            }
            this.buttonRefs.get(this.focusedIndex)?.focus();
        }
        if (event.key === 'ArrowUp') {
            if (this.focusedIndex === null || this.focusedIndex === 0) {
                this.focusedIndex = this.buttonRefs.size - 1;
            } else {
                this.focusedIndex = (this.focusedIndex - 1) % this.buttonRefs.size;
            }
            this.buttonRefs.get(this.focusedIndex)?.focus();
        }
        if (event.key === 'Escape') {
            this.closeMenu();
        }
        this.buttonRefs.forEach((button, index) => {
            if (event.key === String(index + 1)) {
                button.focus();
            }
        });
    };

    handleClickOnDragHandle = (event: React.MouseEvent<HTMLDivElement>) => {
        if (this.state.isAnyDragging) {
            event.stopPropagation();
        }
    };

    editServer = (serverId: string) => {
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.desktop.serverDropdown.showEditServerModal(serverId);
            this.closeMenu();
        };
    };

    removeServer = (serverId: string) => {
        if (this.serverIsPredefined(serverId)) {
            return () => {};
        }
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.desktop.serverDropdown.showRemoveServerModal(serverId);
            this.closeMenu();
        };
    };

    serverIsPredefined = (serverId: string) => {
        return this.state.servers?.some((server) => server.id === serverId && server.isPredefined);
    };

    render() {
        if (!this.state.nonce) {
            return null;
        }

        return (
            <IntlProvider>
                <div
                    onClick={this.preventPropagation}
                    className={classNames('ServerDropdown', {
                        darkMode: this.state.darkMode,
                    })}
                    style={{
                        maxHeight: this.state.windowBounds ? (this.state.windowBounds.height - TAB_BAR_HEIGHT - 16) : undefined,
                        maxWidth: this.state.windowBounds ? (this.state.windowBounds.width - THREE_DOT_MENU_WIDTH_MAC) : undefined,
                    }}
                >
                    <div className='ServerDropdown__header'>
                        <span className='ServerDropdown__servers'>
                            <FormattedMessage
                                id='renderer.dropdown.servers'
                                defaultMessage='Servers'
                            />
                        </span>
                        <span className='ServerDropdown__keyboardShortcut'>
                            {window.process.platform === 'darwin' ? '⌃⌘S' : 'Ctrl + Shift + S'}
                        </span>
                    </div>
                    <hr className='ServerDropdown__divider'/>
                    <DragDropContext
                        nonce={this.state.nonce}
                        onDragStart={this.onDragStart}
                        onDragEnd={this.onDragEnd}
                    >
                        <Droppable
                            isDropDisabled={this.state.hasGPOServers}
                            droppableId='ServerDropdown__droppable'
                        >
                            {(provided) => (
                                <div
                                    className='ServerDropdown__droppable'
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    {this.state.servers?.map((server, orderedIndex) => {
                                        const index = this.state.servers?.indexOf(server);
                                        const sessionExpired = this.state.expired?.get(server.id!);
                                        const hasUnreads = this.state.unreads?.get(server.id!);
                                        const mentionCount = this.state.mentions?.get(server.id!);

                                        let badgeDiv: React.ReactNode;
                                        if (sessionExpired) {
                                            badgeDiv = (
                                                <div className='ServerDropdown__badge-expired'>
                                                    <i className='icon-alert-circle-outline'/>
                                                </div>
                                            );
                                        } else if (mentionCount && mentionCount > 0) {
                                            badgeDiv = (
                                                <div className='ServerDropdown__badge-count'>
                                                    <span>{mentionCount > 99 ? '99+' : mentionCount}</span>
                                                </div>
                                            );
                                        } else if (hasUnreads) {
                                            badgeDiv = (
                                                <div className='ServerDropdown__badge-dot'/>
                                            );
                                        }

                                        return (
                                            <Draggable
                                                key={index}
                                                draggableId={`ServerDropdown__draggable-${index}`}
                                                index={orderedIndex}
                                                disableInteractiveElementBlocking={true}
                                            >
                                                {(provided, snapshot) => (
                                                    <button
                                                        className={classNames('ServerDropdown__button', {
                                                            dragging: snapshot.isDragging,
                                                            anyDragging: this.state.isAnyDragging,
                                                            active: this.isActiveServer(server),
                                                        })}
                                                        ref={this.setButtonRef(orderedIndex, provided.innerRef)}
                                                        {...provided.draggableProps}
                                                        onClick={this.selectServer(server)}
                                                        style={getStyle(provided.draggableProps.style)}
                                                    >
                                                        <div
                                                            className={classNames('ServerDropdown__draggable-handle', {
                                                                dragging: snapshot.isDragging,
                                                            })}
                                                            {...provided.dragHandleProps}
                                                            onClick={this.handleClickOnDragHandle}
                                                        >
                                                            <i className='icon-drag-vertical'/>
                                                            {this.isActiveServer(server) ? <i className='icon-check'/> : <i className='icon-server-variant'/>}
                                                            <span>{server.name}</span>
                                                        </div>
                                                        <div className='ServerDropdown__indicators'>
                                                            <button
                                                                className='ServerDropdown__button-edit'
                                                                onClick={this.editServer(server.id!)}
                                                            >
                                                                <i className='icon-pencil-outline'/>
                                                            </button>
                                                            {!server.isPredefined &&
                                                                <button
                                                                    className='ServerDropdown__button-remove'
                                                                    onClick={this.removeServer(server.id!)}
                                                                >
                                                                    <i className='icon-trash-can-outline'/>
                                                                </button>
                                                            }
                                                            {badgeDiv && <div className='ServerDropdown__badge'>
                                                                {badgeDiv}
                                                            </div>}
                                                        </div>
                                                    </button>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                    <hr className='ServerDropdown__divider'/>
                    {this.state.enableServerManagement &&
                        <button
                            ref={(ref) => {
                                this.addButtonRef(this.state.servers?.length || 0, ref);
                            }}
                            className='ServerDropdown__button addServer'
                            onClick={this.addServer}
                        >
                            <i className='icon-plus'/>
                            <FormattedMessage
                                id='renderer.dropdown.addAServer'
                                defaultMessage='Add a server'
                            />
                        </button>
                    }
                </div>
            </IntlProvider>
        );
    }
}

ReactDOM.render(
    <ServerDropdown/>,
    document.getElementById('app'),
);
