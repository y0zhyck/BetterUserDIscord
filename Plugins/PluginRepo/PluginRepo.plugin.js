/**
 * @name PluginRepo
 * @authorId 278543574059057154
 * @invite Jx3TjNS
 * @donate https://www.paypal.me/MircoWittrien
 * @patreon https://www.patreon.com/MircoWittrien
 * @website https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/PluginRepo
 * @source https://raw.githubusercontent.com/mwittrien/BetterDiscordAddons/master/Plugins/PluginRepo/PluginRepo.plugin.js
 * @updateUrl https://raw.githubusercontent.com/mwittrien/BetterDiscordAddons/master/Plugins/PluginRepo/PluginRepo.plugin.js
 */

module.exports = (_ => {
	const config = {
		"info": {
			"name": "PluginRepo",
			"author": "DevilBro",
			"version": "2.1.2",
			"description": "Allow you to look at all plugins from the plugin repo and download them on the fly"
		},
		"changeLog": {
			"fixed": {
				"New Settings Order": "Fixed for new settings order"
			}
		}
	};

	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		getName () {return config.info.name;}
		getAuthor () {return config.info.author;}
		getVersion () {return config.info.version;}
		getDescription () {return `The Library Plugin needed for ${config.info.name} is missing. Open the Plugin Settings to download it. \n\n${config.info.description}`;}
		
		downloadLibrary () {
			require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
				if (!e && b && b.indexOf(`* @name BDFDB`) > -1) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => {});
				else BdApi.alert("Error", "Could not download BDFDB Library Plugin, try again later or download it manually from GitHub: https://github.com/mwittrien/BetterDiscordAddons/tree/master/Library/");
			});
		}
		
		load () {
			if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
			if (!window.BDFDB_Global.downloadModal) {
				window.BDFDB_Global.downloadModal = true;
				BdApi.showConfirmationModal("Library Missing", `The Library Plugin needed for ${config.info.name} is missing. Please click "Download Now" to install it.`, {
					confirmText: "Download Now",
					cancelText: "Cancel",
					onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
					onConfirm: _ => {
						delete window.BDFDB_Global.downloadModal;
						this.downloadLibrary();
					}
				});
			}
			if (!window.BDFDB_Global.pluginQueue.includes(config.info.name)) window.BDFDB_Global.pluginQueue.push(config.info.name);
		}
		start () {this.load();}
		stop () {}
		getSettingsPanel () {
			let template = document.createElement("template");
			template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${config.info.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
			template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
			return template.content.firstElementChild;
		}
	} : (([Plugin, BDFDB]) => {
		const isBeta = !(window.BdApi && !Array.isArray(BdApi.settings));
		var _this;
		var loading, cachedPlugins, grabbedPlugins, foundPlugins, loadedPlugins, updateInterval;
		var list, header, searchTimeout, forcedSort, forcedOrder, showOnlyOutdated;
		var settings = {}, modalSettings = {}, favorites = [], customList = [];
		
		const pluginStates = {
			UPDATED: 0,
			OUTDATED: 1,
			DOWNLOADABLE: 2
		};
		const buttonData = {
			UPDATED: {
				colorClass: "GREEN",
				backgroundColor: "STATUS_GREEN",
				icon: "CHECKMARK",
				text: "updated"
			},
			OUTDATED: {
				colorClass: "RED",
				backgroundColor: "STATUS_RED",
				icon: "CLOSE",
				text: "outdated"
			},
			DOWNLOADABLE: {
				colorClass: "BRAND",
				backgroundColor: "var(--bdfdb-blurple)",
				icon: "DOWNLOAD",
				text: "download"
			}
		};
		const favStates = {
			FAVORIZED: 0,
			NOT_FAVORIZED: 1
		};
		const newStates = {
			NEW: 0,
			NOT_NEW: 1
		};
		const sortKeys = {
			NAME:			"Name",
			AUTHOR:			"Author",
			VERSION:		"Version",
			DESCRIPTION:	"Description",
			STATE:			"Update State",
			FAV:			"Favorites",
			NEW:			"New Plugins"
		};
		const orderKeys = {
			ASC:			"ascending",
			DESC:			"descending"
		};
		
		const pluginRepoIcon = `<svg width="35" height="32" viewBox="0 0 35 32"><path fill="COLOR_1" d="m 0,15.999383 v 15.999393 h 4.0579876 4.0579875 v -4.669578 -4.669486 h 3.0160369 c 4.130876,0 5.268288,-0.180687 7.310013,-1.16151 C 27.221688,17.280747 26.3676,3.6154073 17.137662,0.62878797 15.190263,-0.00131638 15.210826,2.2791846e-8 7.074025,2.2791846e-8 H 0 V 15.999383 M 13.791313,7.7097692 c 3.0968,0.8058133 3.60605,5.6369388 0.769299,7.2975188 -0.648724,0.379824 -0.954887,0.41296 -3.815,0.41296 H 8.1159751 V 11.510851 7.6015465 h 2.6296369 c 2.100001,0 2.71355,0.021803 3.045701,0.1082227 z"/><path fill="COLOR_2" d="m 19.831613,0.33428402 c 2.750824,1.55218268 4.906474,4.40793308 5.639199,7.47042048 0.0952,0.3980164 0.170276,0.5575479 0.303189,0.6446156 1.427999,0.934759 1.560999,3.8503849 0.238524,5.2283499 -0.315088,0.328422 -0.3633,0.426947 -0.53585,1.096389 -0.7994,3.099994 -2.734025,5.785188 -5.290337,7.342709 -0.100893,0.0615 0.420787,0.809392 3.4594,4.959094 l 3.578225,4.886631 3.887975,0.01882 L 35,32 V 30.448249 28.896416 L 31.879575,24.969021 28.75915,21.041616 29.180725,20.883309 C 32.66865,19.573354 34.5842,16.582282 34.939888,11.89051 35.3941,5.9002298 32.594625,1.7229963 27.245312,0.40867105 25.7768,0.04790474 25.173225,2.2791846e-8 22.092175,2.2791846e-8 H 19.23915 L 19.831613,0.33428402 M 17.753663,23.249872 C 16.088537,23.833028 14.7469,24.036278 12.2283,24.08698 l -2.010924,0.04052 v 3.935622 3.935705 h 4.130436 4.130438 v -4.488532 c 0,-2.468667 -0.02441,-4.485735 -0.05434,-4.482331 -0.02993,0.0031 -0.331537,0.103328 -0.67025,0.221958 z"/></svg>`;
		
		const RepoListComponent = class PluginList extends BdApi.React.Component {
			componentDidMount() {
				list = this;
				BDFDB.TimeUtils.timeout(_ => {
					forcedSort = null;
					forcedOrder = null;
					showOnlyOutdated = false;
				}, 5000);
			}
			filterPlugins () {
				let plugins = Object.keys(loadedPlugins).map(url => {
					let plugin = loadedPlugins[url];
					let instPlugin = BDFDB.BDUtils.getPlugin(plugin.getName);
					if (instPlugin && typeof instPlugin.getAuthor == "function" && _this.getString(instPlugin.getAuthor()).toUpperCase() == plugin.getAuthor.toUpperCase()) plugin.getState = _this.getString(instPlugin.getVersion()) != plugin.getVersion ? pluginStates.OUTDATED : pluginStates.UPDATED;
					else plugin.getState = pluginStates.DOWNLOADABLE;
					return {
						url: plugin.url,
						search: (plugin.getName + " " + plugin.getVersion + " " + plugin.getAuthor + " " + plugin.getDescription).toUpperCase(),
						name: plugin.getName,
						version: plugin.getVersion,
						author: plugin.getAuthor,
						description: plugin.getDescription || "No Description found",
						fav: favorites.includes(url) ? favStates.FAVORIZED : favStates.NOT_FAVORIZED,
						new: plugin.getState == pluginStates.DOWNLOADABLE && !cachedPlugins.includes(url) ? newStates.NEW : newStates.NOT_NEW,
						state: plugin.getState
					};
				});
				if (!this.props.updated)		plugins = plugins.filter(plugin => plugin.state != pluginStates.UPDATED);
				if (!this.props.outdated)		plugins = plugins.filter(plugin => plugin.state != pluginStates.OUTDATED);
				if (!this.props.downloadable)	plugins = plugins.filter(plugin => plugin.state != pluginStates.DOWNLOADABLE);
				if (this.props.searchString) 	{
					let searchString = this.props.searchString.toUpperCase();
					plugins = plugins.filter(plugin => plugin.search.indexOf(searchString) > -1);
				}

				BDFDB.ArrayUtils.keySort(plugins, (!this.props.sortKey || this.props.sortKey == "NEW" && !plugins.some(plugin => plugin.new == newStates.NEW) ? Object.keys(sortKeys)[0] : this.props.sortKey).toLowerCase());
				if (this.props.orderKey == "DESC") plugins.reverse();
				return plugins;
			}
			render() {
				let automaticLoading = BDFDB.BDUtils.getSettings(BDFDB.BDUtils.settingsIds.automaticLoading);
				if (!this.props.tab) this.props.tab = "Plugins";
				this.props.entries = (!loading.is && !BDFDB.ObjectUtils.isEmpty(loadedPlugins) ? this.filterPlugins() : []).map(plugin => BDFDB.ReactUtils.createElement(RepoCardComponent, {
					plugin: plugin
				})).filter(n => n);
				
				BDFDB.TimeUtils.timeout(_ => {
					if (!loading.is && header && this.props.entries.length != header.props.amount) {
						header.props.amount = this.props.entries.length;
						BDFDB.ReactUtils.forceUpdate(header);
					}
				});
				
				return [
					BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.ModalComponents.ModalTabContent, {
						tab: "Plugins",
						open: this.props.tab == "Plugins",
						render: false,
						children: loading.is ? BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
							direction: BDFDB.LibraryComponents.Flex.Direction.VERTICAL,
							justify: BDFDB.LibraryComponents.Flex.Justify.CENTER,
							style: {marginTop: "50%"},
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Spinner, {
									type: BDFDB.LibraryComponents.Spinner.Type.WANDERING_CUBES
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextElement, {
									className: BDFDB.disCN.margintop20,
									style: {textAlign: "center"},
									children: `${BDFDB.LanguageUtils.LibraryStringsFormat("loading", "Plugin Repo")} - ${BDFDB.LanguageUtils.LibraryStrings.please_wait}`
								})
							]
						}) : BDFDB.ReactUtils.forceStyle(BDFDB.ReactUtils.createElement("div", {
							className: BDFDB.disCN._repolist,
							style: {
								display: "flex",
								flexDirection: "column",
								margin: "unset",
								width: "unset"
							},
							children: this.props.entries
						}), ["display", "flex-direction", "margin", "width"])
					}),
					BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.ModalComponents.ModalTabContent, {
						tab: BDFDB.LanguageUtils.LanguageStrings.SETTINGS,
						open: this.props.tab == BDFDB.LanguageUtils.LanguageStrings.SETTINGS,
						render: false,
						children: [
							!automaticLoading && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
								className: BDFDB.disCN.marginbottom20,
								children: BDFDB.ReactUtils.createElement("div", {
									className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCNS.settingsrowtitledefault + BDFDB.disCN.cursordefault,
									children: "To experience PluginRepo in the best way. I would recommend you to enable BD intern reload function, that way all downloaded files are loaded into Discord without the need to reload."
								})
							}),
							Object.keys(modalSettings).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
								className: BDFDB.disCN.marginbottom20,
								type: "Switch",
								plugin: _this,
								keys: ["modalSettings", key],
								label: _this.defaults.modalSettings[key].description,
								note: key == "rnmStart" && !automaticLoading && "Automatic Loading has to be enabled",
								disabled: key == "rnmStart" && !automaticLoading,
								value: this.props[key],
								onChange: (value, instance) => {
									this.props[key] = value;
									BDFDB.ReactUtils.forceUpdate(this);
								}
							}))
						].flat(10).filter(n => n)
					})
				];
			}
		};
		
		const RepoCardComponent = class PluginCard extends BdApi.React.Component {
			render() {
				let buttonConfig = buttonData[(Object.entries(pluginStates).find(n => n[1] == this.props.plugin.state) || [])[0]];
				return buttonConfig && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.AddonCard, {
					icon: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
						className: BDFDB.disCN._repoicon,
						nativeClass: true,
						iconSVG: `<svg viewBox="0 0 24 24" fill="#FFFFFF" style="width: 18px; height: 18px;"><path d="M0 0h24v24H0z" fill="none"></path><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"></path></svg>`
					}),
					data: this.props.plugin,
					controls: [
						this.props.plugin.new == newStates.NEW && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Badges.TextBadge, {
							style: {
								borderRadius: 3,
								textTransform: "uppercase",
								background: BDFDB.DiscordConstants.Colors.STATUS_YELLOW
							},
							text: BDFDB.LanguageUtils.LanguageStrings.NEW
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FavButton, {
							className: BDFDB.disCN._repocontrolsbutton,
							isFavorite: this.props.plugin.fav == favStates.FAVORIZED,
							onClick: value => {
								this.props.plugin.fav = value ? favStates.FAVORIZED : favStates.NOT_FAVORIZED;
								if (value) favorites.push(this.props.plugin.url);
								else BDFDB.ArrayUtils.remove(favorites, this.props.plugin.url, true);
								BDFDB.DataUtils.save(favorites, _this, "favorites");
							}
						}),
						!isBeta && BDFDB.ReactUtils.createElement("div", {
							className: BDFDB.disCN._repocontrolsbutton,
							children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TooltipContainer, {
								text: "Go to Source",
								children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
									name: BDFDB.LibraryComponents.SvgIcon.Names.GITHUB,
									className: BDFDB.disCN._repoicon,
									onClick: _ => {
										let gitUrl = null;
										if (this.props.plugin.url.indexOf("https://raw.githubusercontent.com") == 0) {
											let temp = this.props.plugin.url.replace("//raw.githubusercontent", "//github").split("/");
											temp.splice(5, 0, "blob");
											gitUrl = temp.join("/");
										}
										else if (this.props.plugin.url.indexOf("https://gist.githubusercontent.com/") == 0) {
											gitUrl = this.props.plugin.url.replace("//gist.githubusercontent", "//gist.github").split("/raw/")[0];
										}
										if (gitUrl) BDFDB.DiscordUtils.openLink(gitUrl);
									}
								})
							})
						})
					],
					links: isBeta && [{
						label: "Source",
						icon: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
							name: BDFDB.LibraryComponents.SvgIcon.Names.GITHUB,
							nativeClass: true,
							width: 18,
							height: 18
						}),
						onClick: _ => {
							let gitUrl = null;
							if (this.props.plugin.url.indexOf("https://raw.githubusercontent.com") == 0) {
								let temp = this.props.plugin.url.replace("//raw.githubusercontent", "//github").split("/");
								temp.splice(5, 0, "blob");
								gitUrl = temp.join("/");
							}
							else if (this.props.plugin.url.indexOf("https://gist.githubusercontent.com/") == 0) {
								gitUrl = this.props.plugin.url.replace("//gist.githubusercontent", "//gist.github").split("/raw/")[0];
							}
							if (gitUrl) BDFDB.DiscordUtils.openLink(gitUrl);
						}
					}],
					buttons: isBeta ? [
						this.props.plugin.state != pluginStates.DOWNLOADABLE && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TooltipContainer, {
							text: BDFDB.LanguageUtils.LanguageStrings.DELETE,
							children: BDFDB.ReactUtils.createElement("div", {
								className: BDFDB.disCNS._repobutton + BDFDB.disCNS._repocontrolsbutton + BDFDB.disCN._repobuttondanger,
								onClick: _ => {
									_this.stopPlugin(this.props.plugin);
									_this.deletePluginFile(this.props.plugin);
									this.props.plugin.state = pluginStates.DOWNLOADABLE;
									BDFDB.ReactUtils.forceUpdate(this);
								},
								children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
									name: BDFDB.LibraryComponents.SvgIcon.Names.TRASH,
									nativeClass: true,
									color: "#FFFFFF",
									width: 20,
									height: 20
								})
							})
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TooltipContainer, {
							text: BDFDB.LanguageUtils.LibraryStrings[buttonConfig.text],
							children: BDFDB.ReactUtils.createElement("div", {
								className: BDFDB.disCNS._repobutton + BDFDB.disCN._repocontrolsbutton,
								style: {backgroundColor: BDFDB.DiscordConstants.Colors[buttonConfig.backgroundColor] || buttonConfig.backgroundColor},
								onClick: _ => {
									_this.downloadPlugin(this.props.plugin);
									if (list && list.props.rnmStart) BDFDB.TimeUtils.timeout(_ => {
										if (this.props.plugin.state == pluginStates.UPDATED) _this.startPlugin(this.props.plugin);
									}, 3000);
									this.props.plugin.state = pluginStates.UPDATED;
									BDFDB.ReactUtils.forceUpdate(this);
								},
								children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
									name: BDFDB.LibraryComponents.SvgIcon.Names[buttonConfig.icon],
									nativeClass: true,
									color: "#FFFFFF",
									width: 20,
									height: 20
								})
							})
						})
					] : [
						this.props.plugin.state != pluginStates.DOWNLOADABLE && BDFDB.ReactUtils.createElement("div", {
							className: BDFDB.disCN._repocontrolsbutton,
							children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TooltipContainer, {
								text: BDFDB.LanguageUtils.LanguageStrings.DELETE,
								children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
									name: BDFDB.LibraryComponents.SvgIcon.Names.NOVA_TRASH,
									className: BDFDB.disCN._repoicon,
									onClick: (e, instance) => {
										_this.stopPlugin(this.props.plugin);
										_this.deletePluginFile(this.props.plugin);
										this.props.plugin.state = pluginStates.DOWNLOADABLE;
										BDFDB.ReactUtils.forceUpdate(this);
									}
								})
							})
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Button, {
							size: BDFDB.LibraryComponents.Button.Sizes.MIN,
							color: BDFDB.LibraryComponents.Button.Colors[buttonConfig.colorClass],
							style: {backgroundColor: BDFDB.DiscordConstants.Colors[buttonConfig.backgroundColor] || buttonConfig.backgroundColor},
							children: BDFDB.LanguageUtils.LibraryStrings[buttonConfig.text],
							onClick: (e, instance) => {
								_this.downloadPlugin(this.props.plugin);
								if (list && list.props.rnmStart) BDFDB.TimeUtils.timeout(_ => {
									if (this.props.plugin.state == pluginStates.UPDATED) _this.startPlugin(this.props.plugin);
								}, 3000);
								this.props.plugin.state = pluginStates.UPDATED;
								BDFDB.ReactUtils.forceUpdate(this);
							}
						})
					]
				});
			}
		};
		
		const RepoListHeaderComponent = class PluginListHeader extends BdApi.React.Component {
			componentDidMount() {
				header = this;
			}
			render() {
				if (!this.props.tab) this.props.tab = "Plugins";
				return BDFDB.ReactUtils.createElement("div", {
					className: BDFDB.disCN._repolistheader,
					children: [
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
							className: BDFDB.disCN.marginbottom4,
							align: BDFDB.LibraryComponents.Flex.Align.CENTER,
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormComponents.FormTitle, {
									tag: BDFDB.LibraryComponents.FormComponents.FormTitle.Tags.H2,
									className: BDFDB.disCN.marginreset,
									children: `Plugin Repo ??? ${loading.is ? 0 : this.props.amount || 0}/${loading.is ? 0 : Object.keys(loadedPlugins).length}`
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
									children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SearchBar, {
										autoFocus: true,
										query: this.props.searchString,
										onChange: (value, instance) => {
											if (loading.is) return;
											BDFDB.TimeUtils.clear(searchTimeout);
											searchTimeout = BDFDB.TimeUtils.timeout(_ => {
												this.props.searchString = list.props.searchString = value.replace(/[<|>]/g, "");
												BDFDB.ReactUtils.forceUpdate(this, list);
											}, 1000);
										},
										onClear: instance => {
											if (loading.is) return;
											this.props.searchString = list.props.searchString = "";
											BDFDB.ReactUtils.forceUpdate(this, list);
										}
									})
								})
							]
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
							className: BDFDB.disCNS.tabbarcontainer + BDFDB.disCN.tabbarcontainerbottom,
							align: BDFDB.LibraryComponents.Flex.Align.CENTER,
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
									children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TabBar, {
										className: BDFDB.disCN.tabbar,
										itemClassName: BDFDB.disCN.tabbaritem,
										type: BDFDB.LibraryComponents.TabBar.Types.TOP,
										selectedItem: this.props.tab,
										items: [{value: "Plugins"}, {value: BDFDB.LanguageUtils.LanguageStrings.SETTINGS}],
										onItemSelect: (value, instance) => {
											this.props.tab = list.props.tab = value;
											BDFDB.ReactUtils.forceUpdate(list);
										}
									})
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
									children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.QuickSelect, {
										label: BDFDB.LanguageUtils.LibraryStrings.sort_by + ":",
										value: {
											label: sortKeys[this.props.sortKey],
											value: this.props.sortKey
										},
										options: Object.keys(sortKeys).filter(n => n != "NEW" || Object.keys(loadedPlugins).some(p => !cachedPlugins.includes(p))).map(key => ({
											label: sortKeys[key],
											value: key
										})),
										onChange: (key, instance) => {
											this.props.sortKey = list.props.sortKey = key;
											BDFDB.ReactUtils.forceUpdate(this, list);
										}
									})
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
									children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.QuickSelect, {
										label: BDFDB.LanguageUtils.LibraryStrings.order + ":",
										value: {
											label: BDFDB.LanguageUtils.LibraryStrings[orderKeys[this.props.orderKey]],
											value: this.props.orderKey
										},
										options: Object.keys(orderKeys).map(key => ({
											label: BDFDB.LanguageUtils.LibraryStrings[orderKeys[key]],
											value: key
										})),
										onChange: (key, instance) => {
											this.props.orderKey = list.props.orderKey = key;
											BDFDB.ReactUtils.forceUpdate(this, list);
										}
									})
								})
							]
						})
					]
				});
			}
		};
	
		return class PluginRepo extends Plugin {
			onLoad () {
				_this = this;
				
				loading = {is: false, timeout: null, amount: 0};

				cachedPlugins = [];
				grabbedPlugins = [];
				foundPlugins = [];
				loadedPlugins = {};

				this.defaults = {
					settings: {
						notifyOutdated:		{value: true, 	description: "Get a Notification when one of your Plugins is outdated"},
						notifyNewEntries:	{value: true, 	description: "Get a Notification when there are new Entries in the Repo"}
					},
					modalSettings: {
						updated: 			{value: true,	modify: true,	description: "Show updated Plugins",},
						outdated:			{value: true, 	modify: true,	description: "Show outdated Plugins"},
						downloadable:		{value: true, 	modify: true,	description: "Show downloadable Plugins"},
						rnmStart:			{value: true, 	modify: false,	description: "Start Plugin after Download"}
					}
				};
			
				this.patchedModules = {
					before: {
						SettingsView: "render"
					},
					after: {
						StandardSidebarView: "render"
					}
				};
				
			}
			
			onStart () {
				this.forceUpdateAll();

				this.loadPlugins();

				updateInterval = BDFDB.TimeUtils.interval(_ => {this.checkForNewPlugins();}, 1000*60*30);
			}
			
			onStop () {
				BDFDB.TimeUtils.clear(updateInterval);
				BDFDB.TimeUtils.clear(loading.timeout);

				this.forceUpdateAll();

				BDFDB.DOMUtils.remove(BDFDB.dotCN._pluginreponotice, BDFDB.dotCN._pluginrepoloadingicon);
			}

			getSettingsPanel (collapseStates = {}) {
				let customUrl = "";
				let settingsPanel, settingsItems = [];
				
				settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
					title: "Settings",
					collapseStates: collapseStates,
					children: Object.keys(settings).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
						type: "Switch",
						plugin: this,
						keys: ["settings", key],
						label: this.defaults.settings[key].description,
						value: settings[key]
					}))
				}));
				settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
					title: "Custom Plugins",
					collapseStates: collapseStates,
					children: [
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormComponents.FormItem, {
							title: "Add Plugin:",
							tag: BDFDB.LibraryComponents.FormComponents.FormTitleTags.H3,
							className: BDFDB.disCNS.margintop4 + BDFDB.disCN.marginbottom8,
							children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
								align: BDFDB.LibraryComponents.Flex.Align.CENTER,
								children: [
									BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
										children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextInput, {
											placeholder: customUrl,
											placeholder: "Insert Raw Github Link of Plugin (https://raw.githubusercontent.com/...)",
											onChange: value => {customUrl = value.trim();}
										})
									}),
									BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Button, {
										onClick: _ => {
											if (customUrl) {
												customList.push(customUrl);
												BDFDB.DataUtils.save(BDFDB.ArrayUtils.removeCopies(customList), this, "custom");
												BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
											}
										},
										children: BDFDB.LanguageUtils.LanguageStrings.ADD
									})
								]
							})
						}),
						customList.length ? BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsPanelList, {
							title: "Custom Plugin List:",
							className: BDFDB.disCNS.margintop8 + BDFDB.disCN.marginbottom20,
							children: customList.map(url => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Card, {
								children: url,
								onRemove: _ => {
									BDFDB.ArrayUtils.remove(customList, url, true);
									BDFDB.DataUtils.save(customList, this, "custom");
									BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
								}
							}))
						}) : null,
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
							type: "Button",
							color: BDFDB.LibraryComponents.Button.Colors.RED,
							label: "Remove all custom added Plugins",
							onClick: _ => {
								BDFDB.ModalUtils.confirm(this, "Are you sure you want to remove all added Plugins from your own list", _ => {
									BDFDB.DataUtils.save([], this, "custom");
									BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
								});
							},
							children: BDFDB.LanguageUtils.LanguageStrings.REMOVE
						})
					].flat(10).filter(n => n)
				}));
				settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
					title: "Refetch All",
					collapseStates: collapseStates,
					children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
						type: "Button",
						label: "Force all Plugins to be fetched again",
						onClick: _ => {
							loading = {is: false, timeout: null, amount: 0};
							this.loadPlugins();
						},
						children: BDFDB.LanguageUtils.LanguageStrings.ERRORS_RELOAD
					})
				}));
				
				return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, settingsItems);
			}
			
			onSettingsClosed () {
				if (this.SettingsUpdated) {
					delete this.SettingsUpdated;
					this.forceUpdateAll();
				}
			}
			
			forceUpdateAll () {
				settings = BDFDB.DataUtils.get(this, "settings");
				modalSettings = BDFDB.DataUtils.get(this, "modalSettings");
				favorites = BDFDB.DataUtils.load(this, "favorites");
				favorites = BDFDB.ArrayUtils.is(favorites) ? favorites : [];
				customList = BDFDB.DataUtils.load(this, "custom");
				customList = BDFDB.ArrayUtils.is(customList) ? customList : [];
				
				BDFDB.PatchUtils.forceAllUpdates(this);
			}

			onUserSettingsCogContextMenu (e) {
				BDFDB.TimeUtils.timeout(_ => {
					let [children, index] = BDFDB.ReactUtils.findParent(e.returnvalue, {props: [["label", ["BandagedBD", "BetterDiscord"]]]});
					if (index > -1 && BDFDB.ArrayUtils.is(children[index].props.children)) children[index].props.children.push(BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
						label: "Plugin Repo",
						id: BDFDB.ContextMenuUtils.createItemId(this.name, "repo"),
						action: _ => {
							BDFDB.LibraryModules.UserSettingsUtils.open("pluginrepo");
						}
					}));
				});
			}
			
			processSettingsView (e) {
				if (BDFDB.ArrayUtils.is(e.instance.props.sections) && e.instance.props.sections[0] && e.instance.props.sections[0].label == BDFDB.LanguageUtils.LanguageStrings.USER_SETTINGS) {
					e.instance.props.sections = e.instance.props.sections.filter(n => n.section != "pluginrepo");
					let index = e.instance.props.sections.indexOf(e.instance.props.sections.find(n => n.section == "themes") || e.instance.props.sections.find(n => n.section == BDFDB.DiscordConstants.UserSettingsSections.DEVELOPER_OPTIONS) || e.instance.props.sections.find(n => n.section == BDFDB.DiscordConstants.UserSettingsSections.HYPESQUAD_ONLINE));
					if (index > -1) {
						e.instance.props.sections.splice(index + 1, 0, {
							section: "pluginrepo",
							label: "Plugin Repo",
							element: _ => {
								let options = Object.assign({}, modalSettings);
								options.updated = options.updated && !showOnlyOutdated;
								options.outdated = options.outdated || showOnlyOutdated;
								options.downloadable = options.downloadable && !showOnlyOutdated;
								options.searchString = "";
								options.sortKey = forcedSort || Object.keys(sortKeys)[0];
								options.orderKey = forcedOrder || Object.keys(orderKeys)[0];
								
								return BDFDB.ReactUtils.createElement(RepoListComponent, options, true);
							}
						});
						if (!e.instance.props.sections.find(n => n.section == "plugins")) e.instance.props.sections.splice(index + 1, 0, {section: "DIVIDER"});
					}
				}
			}
			
			processStandardSidebarView (e) {
				if (BDFDB.ObjectUtils.get(e, "instance.props.content.props.section") == "pluginrepo") {
					let content = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.settingswindowcontentregion]]});
					if (content) content.props.className = BDFDB.DOMUtils.formatClassName(BDFDB.disCN._repolistwrapper, content.props.className);
					let [children, index] = BDFDB.ReactUtils.findParent(e.returnvalue, {props: [["className", BDFDB.disCN.settingswindowcontentregionscroller]]});
					if (index > -1) {
						let options = {};
						options.searchString = "";
						options.sortKey = forcedSort || Object.keys(sortKeys)[0];
						options.orderKey = forcedOrder || Object.keys(orderKeys)[0];
						children[index] = [
							BDFDB.ReactUtils.createElement(RepoListHeaderComponent, options, true),
							children[index]
						];
					}
				}
			}

			loadPlugins () {
				BDFDB.DOMUtils.remove(BDFDB.dotCN._pluginrepoloadingicon);
				let settings = BDFDB.DataUtils.load(this, "settings");
				let getPluginInfo, extractConfigInfo, createSandbox, runInSandbox;
				let sandbox, sandboxRunning = false, sandboxQueue = [], outdated = 0, newEntries = 0, i = 0;
				let tags = ["getName", "getVersion", "getAuthor", "getDescription"];
				let seps = ["\"", "\'", "\`"];
				let newEntriesData = BDFDB.DataUtils.load(this, "newentriesdata");
				cachedPlugins = (newEntriesData.urlbase64 ? atob(newEntriesData.urlbase64).split("\n") : []).concat(customList);
				BDFDB.LibraryRequires.request("https://mwittrien.github.io/BetterDiscordAddons/Plugins/PluginRepo/_res/PluginList.txt", (error, response, result) => {
					if (!error && result) {
						result = result.replace(/[\r\t]/g, "");
						BDFDB.DataUtils.save(btoa(result), this, "newentriesdata", "urlbase64");
						
						loadedPlugins = {};
						grabbedPlugins = result.split("\n").filter(n => n);
						foundPlugins = grabbedPlugins.concat(customList);
						
						loading = {is: true, timeout: BDFDB.TimeUtils.timeout(_ => {
							BDFDB.TimeUtils.clear(loading.timeout);
							if (this.started) {
								if (loading.is && loading.amount < 4) BDFDB.TimeUtils.timeout(_ => {this.loadPlugins();},10000);
								loading = {is: false, timeout: null, amount: loading.amount};
							}
						}, 1200000), amount: loading.amount+1};
						
						let loadingIcon = BDFDB.DOMUtils.create(pluginRepoIcon.replace(/COLOR_1/gi, "var(--bdfdb-blurple)").replace(/COLOR_2/gi, "#72767d"));
						BDFDB.DOMUtils.addClass(loadingIcon, BDFDB.disCN._pluginrepoloadingicon);
						loadingIcon.addEventListener("mouseenter", _ => {
							BDFDB.TooltipUtils.create(loadingIcon, this.getLoadingTooltipText(), {
								type: "left",
								className: BDFDB.disCN._pluginrepoloadingtooltip,
								delay: 500,
								style: "max-width: unset;"
							});
						});
						BDFDB.PluginUtils.addLoadingIcon(loadingIcon);

						createSandbox().then(_ => {
							getPluginInfo(_ => {
								if (!this.started) {
									BDFDB.TimeUtils.clear(loading.timeout);
									BDFDB.WindowUtils.close(sandbox);
									return;
								}
								let finishCounter = 0, finishInterval = BDFDB.TimeUtils.interval(_ => { 
									if ((sandboxQueue.length == 0 && !sandboxRunning) || finishCounter > 300 || !loading.is) {
										BDFDB.TimeUtils.clear(loading.timeout);
										BDFDB.TimeUtils.clear(finishInterval);
										BDFDB.WindowUtils.close(sandbox);
										BDFDB.DOMUtils.remove(loadingIcon, BDFDB.dotCN._pluginrepoloadingicon);
										loading = {is: false, timeout: null, amount: loading.amount};
										
										BDFDB.LogUtils.log("Finished fetching Plugins", this.name);
										if (list) BDFDB.ReactUtils.forceUpdate(list);
										
										if (settings.notifyOutdated && outdated > 0) {
											document.querySelector(BDFDB.dotCN._pluginrepooutdatednotice)?.close();
											BDFDB.NotificationUtils.notice(this.labels.notice_outdated_plugins.replace("{{var0}}", outdated), {
												type: "danger",
												className: BDFDB.disCNS._pluginreponotice + BDFDB.disCN._pluginrepooutdatednotice,
												customIcon: pluginRepoIcon.replace(/COLOR_1/gi, "#fff").replace(/COLOR_2/gi, "#b9bbbe"),
												buttons: [{
													contents: BDFDB.LanguageUtils.LanguageStrings.OPEN,
													close: true,
													onClick: _ => {
														showOnlyOutdated = true;
														BDFDB.LibraryModules.UserSettingsUtils.open("pluginrepo");
													}
												}]
											});
										}
										
										if (settings.notifyNewEntries && newEntries > 0) {
											document.querySelector(BDFDB.dotCN._pluginreponewentriesnotice)?.close();
											BDFDB.NotificationUtils.notice(this.labels.notice_new_plugins.replace("{{var0}}", newEntries), {
												type: "success",
												className: BDFDB.disCNS._pluginreponotice + BDFDB.disCN._pluginreponewentriesnotice,
												customIcon: pluginRepoIcon.replace(/COLOR_1/gi, "#fff").replace(/COLOR_2/gi, "#b9bbbe"),
												buttons: [{
													contents: BDFDB.LanguageUtils.LanguageStrings.OPEN,
													close: true,
													onClick: _ => {
														forcedSort = "NEW";
														forcedOrder = "ASC";
														BDFDB.LibraryModules.UserSettingsUtils.open("pluginrepo");
													}
												}]
											});
										}
										
										if (BDFDB.UserUtils.me.id == "278543574059057154") {
											document.querySelector(BDFDB.dotCN._pluginrepofailnotice)?.close();
											let wrongUrls = [];
											for (let url of foundPlugins) if (url && !loadedPlugins[url] && !wrongUrls.includes(url)) wrongUrls.push(url);
											if (wrongUrls.length) {
												BDFDB.NotificationUtils.notice(this.labels.notice_failed_plugins.replace("{{var0}}", wrongUrls.length), {
													type: "danger",
													className: BDFDB.disCNS._pluginreponotice + BDFDB.disCN._pluginrepofailnotice,
													customIcon: pluginRepoIcon.replace(/COLOR_1/gi, "#fff").replace(/COLOR_2/gi, "#b9bbbe"),
													buttons: [{
														contents: this.labels.list,
														onClick: _ => {
															let toast = BDFDB.NotificationUtils.toast(wrongUrls.join("\n"), {type: "danger"});
															toast.style.setProperty("overflow", "hidden");
															for (let url of wrongUrls) console.log(url);
														}
													}]
												});
											}
										}
									}
									else finishCounter++;
								},1000);
							});
						});
					}
				});

				getPluginInfo = callback => {
					if (i >= foundPlugins.length || !this.started || !loading.is) {
						callback();
						return;
					}
					let url = foundPlugins[i];
					BDFDB.LibraryRequires.request(url, (error, response, body) => {
						if (!response) {
							if (url && BDFDB.ArrayUtils.getAllIndexes(foundPlugins, url).length < 2) foundPlugins.push(url);
						}
						else if (body && body.indexOf("404: Not Found") != 0 && response.statusCode == 200) {
							let plugin = {};
							let bodyCopy = body;
							if (body.length / body.split("\n").length > 1000) {
								/* code is minified -> add newlines */
								bodyCopy = body.replace(/}/g, "}\n");
							}
							let bodyWithoutSpecial = bodyCopy.replace(/\n|\r|\t/g, "").replace(/\n|\r|\t/g, "").replace(/\s{2,}/g, "");
							let configReg = /(\.exports|config)\s*=\s*\{(.*?)\s*["'`]*info["'`]*\s*:\s*/i.exec(bodyWithoutSpecial);
							if (configReg) {
								bodyWithoutSpecial = bodyWithoutSpecial.substring(configReg.index)?.split(configReg[0])[1]?.split("};")[0]?.split("}},")[0]?.replace(/,([\]\}])/g, "$1");
								try {
									extractConfigInfo(plugin, JSON.parse('{"info":' + bodyWithoutSpecial + '}'));
								}
								catch (err) {
									let i = 0, j = 0, configString = "";
									try {
										for (let c of bodyWithoutSpecial.replace(/:\s*([\[\{"]+)/g, '":$1').replace(/([\]\}"]+)\s*,([^"])/g, '$1,"$2').replace(/\s*\{([^"])/g, '{"$1')) {
											configString += c;
											if (c == "{") i++;
											else if (c == "}") j++;
											if (i > 0 && i == j) break;
										}
										extractConfigInfo(plugin, JSON.parse('{"info":' + configString + '}'));
									}
									catch (err2) {
										try {extractConfigInfo(plugin, JSON.parse(('{"info":' + configString + '}').replace(/'/g, "\"")));}
										catch (err3) {}
									}
								}
							}
							else {
								let hasMETAline = bodyCopy.replace(/\s/g, "").indexOf("//META{");
								if (!(hasMETAline < 20 && hasMETAline > -1)) {
									let searchText = bodyCopy.replace(/[\r\t| ]*\*\s*/g, "*");
									for (let tag of tags) {
										let result = searchText.split('@' + tag.toLowerCase().slice(3) + ' ');
										result = result.length > 1 ? result[1].split('\n')[0] : null;
										result = result && tag != "getVersion" ? result.charAt(0).toUpperCase() + result.slice(1) : result;
										plugin[tag] = result ? result.trim() : result;
									}
								}
								if (tags.some(tag => !plugin[tag])) {
									for (let tag of tags) {
										let result = new RegExp(tag + "[\\s|\\t|\\n|\\r|=|>|_|:|function|\(|\)|\{|return]*([\"|\'|\`]).*\\1","gi").exec(bodyCopy);
										if (!result) result = new RegExp("get " + tag.replace("get", "").toLowerCase() + "[\\s|\\t|\\n|\\r|=|>|_|:|function|\(|\)|\{|return]*([\"|\'|\`]).*\\1","gi").exec(bodyCopy);
										if (result) {
											let separator = result[1];
											result = result[0].replace(new RegExp("\\\\" + separator, "g"), separator).split(separator);
											if (result.length > 2) {
												result = result.slice(1, -1).join(separator).replace(/\\n/g, "\n").replace(/\\/g, "");
												result = tag != "getVersion" ? result.charAt(0).toUpperCase() + result.slice(1) : result;
												plugin[tag] = result ? result.trim() : result;
											}
										}
									}
								}
							}
							
							if (!tags.some(tag => !plugin[tag] || plugin[tag].length > 10000)) {
								plugin.url = url;
								loadedPlugins[url] = plugin;
								if (this.isPluginOutdated(plugin, url)) outdated++;
								if (!cachedPlugins.includes(url)) newEntries++;
							}
							else if (sandbox) {
								sandboxQueue.push({body, url});
								runInSandbox();
							}
						}
						i++;
						
						let loadingTooltip = document.querySelector(BDFDB.dotCN._pluginrepoloadingtooltip);
						if (loadingTooltip) loadingTooltip.update(this.getLoadingTooltipText());
						
						getPluginInfo(callback);
					});
				};
				
				extractConfigInfo = (plugin, config) => {
					plugin.getName = BDFDB.LibraryModules.StringUtils.upperCaseFirstChar(config.info.name);
					plugin.getDescription = BDFDB.LibraryModules.StringUtils.upperCaseFirstChar(config.info.description);
					plugin.getVersion = config.info.version;
					plugin.getAuthor = "";
					if (typeof config.info.author == "string") plugin.getAuthor = BDFDB.LibraryModules.StringUtils.upperCaseFirstChar(config.info.author);
					else if (typeof config.info.authors == "string") plugin.getAuthor = BDFDB.LibraryModules.StringUtils.upperCaseFirstChar(config.info.authors);
					else if (Array.isArray(config.info.authors)) for (let author of config.info.authors) {
						plugin.getAuthor += (plugin.getAuthor + (plugin.getAuthor ? ", " : "") + BDFDB.LibraryModules.StringUtils.upperCaseFirstChar(typeof author == "string" ? author : author.name || ""));
					}
				};

				createSandbox = _ => {
					return new Promise(callback => {
						let loadTimeout = BDFDB.TimeUtils.timeout(_ => {
							callback();
						}, 600000);
						sandbox = BDFDB.WindowUtils.open(this, "https://mwittrien.github.io/BetterDiscordAddons/Plugins/_res/DiscordPreview.html", {
							onLoad: _ => {
								BDFDB.TimeUtils.clear(loadTimeout);
								sandbox.executeJavaScriptSafe(`window.onmessage({
									origin: "PluginRepo",
									reason: "OnLoad",
									classes: ${JSON.stringify(JSON.stringify(BDFDB.DiscordClasses))},
									classModules: ${JSON.stringify(JSON.stringify(BDFDB.DiscordClassModules))}
								})`);
								callback();
							}
						});
						if (!sandbox) callback();
					});
				}

				runInSandbox = _ => {
					if (sandboxRunning) return;
					let sandboxData = sandboxQueue.shift();
					if (!sandboxData) return;
					let {body, url} = sandboxData;
					let name = (body.replace(/\s*:\s*/g, ":").split('"name":"')[1] || "").split('"')[0];
					name = name ? name : (body.replace(/ {2,}/g, " ").replace(/\r/g, "").split("@name ")[1] || "").split("\n")[0];
					if (name) {
						let messageId = (this.name + name + BDFDB.NumberUtils.generateId()).replace(/\s/g, "").trim();
						sandboxRunning = true;
						BDFDB.WindowUtils.addListener(this, messageId, (event, messageData) => {
							BDFDB.WindowUtils.removeListener(this, messageId);
							if (BDFDB.ObjectUtils.is(messageData.plugin)) {
								messageData.plugin.url = url;
								loadedPlugins[url] = messageData.plugin;
								if (this.isPluginOutdated(messageData.plugin, url)) outdated++;
								if (!cachedPlugins.includes(url)) newEntries++;
							}
							sandboxRunning = false;
							runInSandbox();
						});
						sandbox.executeJavaScriptSafe(`
							let result = null;
							try {
								${body};
								let p = new ${name}();
								result = {
									"getName": getString(p.getName()),
									"getAuthor": getString(p.getAuthor()),
									"getVersion": getString(p.getVersion()),
									"getDescription": getString(p.getDescription())
								};
							}
							catch (err) {}
							window.respondToParent({
								hostId: ${BDFDB.LibraryRequires.electron.remote.getCurrentWindow().webContents.id},
								hostName: "${messageId}",
								plugin: result
							});
						`);
					}
				}
			}

			getLoadingTooltipText () {
				return BDFDB.LanguageUtils.LibraryStringsFormat("loading", `PluginRepo - [${Object.keys(loadedPlugins).length}/${Object.keys(grabbedPlugins).length}]`);
			}
			
			isPluginOutdated (plugin, url) {
				let instPlugin = BDFDB.BDUtils.getPlugin(plugin.getName);
				return instPlugin && typeof instPlugin.getAuthor == "function" && this.getString(instPlugin.getAuthor()).toUpperCase() == plugin.getAuthor.toUpperCase() && this.getString(instPlugin.getVersion()) != plugin.getVersion && !this.pluginHasUpdateCheck(url);
			}
			
			pluginHasUpdateCheck (url) {
				if (!BDFDB.ObjectUtils.is(window.PluginUpdates) || !BDFDB.ObjectUtils.is(window.PluginUpdates.plugins)) return false;
				if (window.PluginUpdates.plugins[url]) return true;
				else {
					let temp = "https://raw.githubusercontent.com/mwittrien/BetterDiscordAddons/master/Plugins/PluginRepo/PluginRepo.plugin.js".replace("//raw.githubusercontent.com", "//").split("/");
					let gitname = temp.splice(3, 1);
					temp.splice(4, 1);
					temp.splice(2, 1, gitname + ".github.io");
					return !!window.PluginUpdates.plugins[temp.join("/")];
				}
			}

			getString (obj) {
				let string = "";
				if (typeof obj == "string") string = obj;
				else if (obj && obj.props) {
					if (typeof obj.props.children == "string") string = obj.props.children;
					else if (Array.isArray(obj.props.children)) for (let c of obj.props.children) string += typeof c == "string" ? c : this.getString(c);
				}
				return string;
			}

			checkForNewPlugins () {
				BDFDB.LibraryRequires.request("https://mwittrien.github.io/BetterDiscordAddons/Plugins/PluginRepo/_res/PluginList.txt", (error, response, result) => {
					if (response && !BDFDB.equals(result.replace(/\t|\r/g, "").split("\n").filter(n => n), grabbedPlugins)) {
						loading = {is: false, timeout: null, amount: 0};
						this.loadPlugins();
					}
				});
			}

			downloadPlugin (data) {
				BDFDB.LibraryRequires.request(data.url, (error, response, body) => {
					if (error) BDFDB.NotificationUtils.toast(BDFDB.LanguageUtils.LibraryStringsFormat("download_fail", `Plugin "${data.getName}"`), {type: "danger"});
					else this.createPluginFile(data.url.split("/").pop(), body);
				});
			}

			createPluginFile (filename, content) {
				BDFDB.LibraryRequires.fs.writeFile(BDFDB.LibraryRequires.path.join(BDFDB.BDUtils.getPluginsFolder(), filename), content, (error) => {
					if (error) BDFDB.NotificationUtils.toast(BDFDB.LanguageUtils.LibraryStringsFormat("save_fail", `Plugin "${filename}"`), {type: "danger"});
					else BDFDB.NotificationUtils.toast(BDFDB.LanguageUtils.LibraryStringsFormat("save_success", `Plugin "${filename}"`), {type: "success"});
				});
			}

			startPlugin (data) {
				if (data.name && BDFDB.BDUtils.isPluginEnabled(data.name) == false) {
					BDFDB.BDUtils.enablePlugin(data.name, false);
					BDFDB.LogUtils.log(BDFDB.LanguageUtils.LibraryStringsFormat("toast_plugin_started", data.name), this.name);
				}
			}

			deletePluginFile (data) {
				let filename = data.url.split("/").pop();
				BDFDB.LibraryRequires.fs.unlink(BDFDB.LibraryRequires.path.join(BDFDB.BDUtils.getPluginsFolder(), filename), (error) => {
					if (error) BDFDB.NotificationUtils.toast(BDFDB.LanguageUtils.LibraryStringsFormat("delete_fail", `Plugin "${filename}"`), {type: "danger"});
					else BDFDB.NotificationUtils.toast(BDFDB.LanguageUtils.LibraryStringsFormat("delete_success", `Plugin "${filename}"`));
				});
			}

			stopPlugin (data) {
				if (data.name && BDFDB.BDUtils.isPluginEnabled(data.name) == true) {
					BDFDB.BDUtils.disablePlugin(data.name, false);
					BDFDB.LogUtils.log(BDFDB.LanguageUtils.LibraryStringsFormat("toast_plugin_stopped", data.name), this.name);
				}
			}

			setLabelsByLanguage () {
				switch (BDFDB.LanguageUtils.getLanguage().id) {
					case "bg":		// Bulgarian
						return {
							list:								"????????????",
							notice_failed_plugins:				"?????????? Plugins [{{var0}}] ???? ???????????? ???? ?????????? ????????????????",
							notice_new_plugins:					"???????????? Plugins [{{var0}}] ???????? ???????????????? ?????? PluginRepo",
							notice_outdated_plugins:			"?????????? Plugins [{{var0}}] ???? ????????????????"
						};
					case "da":		// Danish
						return {
							list:								"Liste",
							notice_failed_plugins:				"Nogle Plugins [{{var0}}] kunne ikke indl??ses",
							notice_new_plugins:					"Nye Plugins [{{var0}}] er blevet f??jet til PluginRepo",
							notice_outdated_plugins:			"Nogle Plugins [{{var0}}] er for??ldede"
						};
					case "de":		// German
						return {
							list:								"Liste",
							notice_failed_plugins:				"Einige Plugins [{{var0}}] konnten nicht geladen werden",
							notice_new_plugins:					"Neue Plugins [{{var0}}] wurden zur PluginRepo hinzugef??gt",
							notice_outdated_plugins:			"Einige Plugins [{{var0}}] sind veraltet"
						};
					case "el":		// Greek
						return {
							list:								"??????????",
							notice_failed_plugins:				"?????? ???????? ???????????? ?? ?????????????? ?????????????????? Plugins [{{var0}}] ",
							notice_new_plugins:					"?????????????????????? ?????? Plugins [{{var0}}] ?????? PluginRepo",
							notice_outdated_plugins:			"???????????????? Plugins [{{var0}}] ?????????? ??????????"
						};
					case "es":		// Spanish
						return {
							list:								"Lista",
							notice_failed_plugins:				"Algunos Plugins [{{var0}}] no se pudieron cargar",
							notice_new_plugins:					"Se han agregado nuevos Plugins [{{var0}}] a PluginRepo",
							notice_outdated_plugins:			"Algunas Plugins [{{var0}}] est??n desactualizadas"
						};
					case "fi":		// Finnish
						return {
							list:								"Lista",
							notice_failed_plugins:				"Joitain kohdetta Plugins [{{var0}}] ei voitu ladata",
							notice_new_plugins:					"Uusi Plugins [{{var0}}] on lis??tty PluginRepo",
							notice_outdated_plugins:			"Jotkut Plugins [{{var0}}] ovat vanhentuneita"
						};
					case "fr":		// French
						return {
							list:								"Liste",
							notice_failed_plugins:				"Certains Plugins [{{var0}}] n'ont pas pu ??tre charg??s",
							notice_new_plugins:					"De nouveaux Plugins [{{var0}}] ont ??t?? ajout??s ?? PluginRepo",
							notice_outdated_plugins:			"Certains Plugins [{{var0}}] sont obsol??tes"
						};
					case "hr":		// Croatian
						return {
							list:								"Popis",
							notice_failed_plugins:				"Neke datoteke Plugins [{{var0}}] nije mogu??e u??itati",
							notice_new_plugins:					"Novi Plugins [{{var0}}] dodani su u PluginRepo",
							notice_outdated_plugins:			"Neki su Plugins [{{var0}}] zastarjeli"
						};
					case "hu":		// Hungarian
						return {
							list:								"Lista",
							notice_failed_plugins:				"N??h??ny Plugins [{{var0}}] nem siker??lt bet??lteni",
							notice_new_plugins:					"??j Plugins [{{var0}}] hozz??adva a k??vetkez??h??z: PluginRepo",
							notice_outdated_plugins:			"N??h??ny Plugins [{{var0}}] elavult"
						};
					case "it":		// Italian
						return {
							list:								"Elenco",
							notice_failed_plugins:				"Impossibile caricare alcuni Plugins [{{var0}}] ",
							notice_new_plugins:					"Il nuovo Plugins [{{var0}}] ?? stato aggiunto a PluginRepo",
							notice_outdated_plugins:			"Alcuni Plugins [{{var0}}] non sono aggiornati"
						};
					case "ja":		// Japanese
						return {
							list:								"?????????",
							notice_failed_plugins:				"????????? Plugins [{{var0}}] ?????????????????????????????????",
							notice_new_plugins:					"????????? Plugins [{{var0}}] ??? PluginRepo ????????????????????????",
							notice_outdated_plugins:			"????????? Plugins [{{var0}}] ???????????????????????????"
						};
					case "ko":		// Korean
						return {
							list:								"??????",
							notice_failed_plugins:				"?????? Plugins [{{var0}}] ??? (???)?????? ??? ??? ????????????.",
							notice_new_plugins:					"??? Plugins [{{var0}}] ??? PluginRepo ??? ?????????????????????.",
							notice_outdated_plugins:			"?????? Plugins [{{var0}}] ??? ?????????????????????."
						};
					case "lt":		// Lithuanian
						return {
							list:								"S??ra??as",
							notice_failed_plugins:				"Kai kuri?? Plugins [{{var0}}] nepavyko ??kelti",
							notice_new_plugins:					"Naujas Plugins [{{var0}}] prid??tas prie PluginRepo",
							notice_outdated_plugins:			"Kai kurie Plugins [{{var0}}] yra pasen??"
						};
					case "nl":		// Dutch
						return {
							list:								"Lijst",
							notice_failed_plugins:				"Sommige Plugins [{{var0}}] konden niet worden geladen",
							notice_new_plugins:					"Nieuwe Plugins [{{var0}}] zijn toegevoegd aan de PluginRepo",
							notice_outdated_plugins:			"Sommige Plugins [{{var0}}] zijn verouderd"
						};
					case "no":		// Norwegian
						return {
							list:								"Liste",
							notice_failed_plugins:				"Noen Plugins [{{var0}}] kunne ikke lastes inn",
							notice_new_plugins:					"Nye Plugins [{{var0}}] er lagt til i PluginRepo",
							notice_outdated_plugins:			"Noen Plugins [{{var0}}] er utdaterte"
						};
					case "pl":		// Polish
						return {
							list:								"Lista",
							notice_failed_plugins:				"Nie mo??na za??adowa?? niekt??rych Plugins [{{var0}}] ",
							notice_new_plugins:					"Nowe Plugins [{{var0}}] zosta??y dodane do PluginRepo",
							notice_outdated_plugins:			"Niekt??re Plugins [{{var0}}] s?? nieaktualne"
						};
					case "pt-BR":	// Portuguese (Brazil)
						return {
							list:								"Lista",
							notice_failed_plugins:				"Algum Plugins [{{var0}}] n??o p??de ser carregado",
							notice_new_plugins:					"Novo Plugins [{{var0}}] foi adicionado ao PluginRepo",
							notice_outdated_plugins:			"Alguns Plugins [{{var0}}] est??o desatualizados"
						};
					case "ro":		// Romanian
						return {
							list:								"List??",
							notice_failed_plugins:				"Unele Plugins [{{var0}}] nu au putut fi ??nc??rcate",
							notice_new_plugins:					"Plugins [{{var0}}] nou au fost ad??ugate la PluginRepo",
							notice_outdated_plugins:			"Unele Plugins [{{var0}}] sunt ??nvechite"
						};
					case "ru":		// Russian
						return {
							list:								"????????????",
							notice_failed_plugins:				"???? ?????????????? ?????????????????? ?????????????????? Plugins [{{var0}}] ",
							notice_new_plugins:					"?????????? Plugins [{{var0}}] ?????????????????? ?? PluginRepo",
							notice_outdated_plugins:			"?????????????????? Plugins [{{var0}}] ????????????????"
						};
					case "sv":		// Swedish
						return {
							list:								"Lista",
							notice_failed_plugins:				"Vissa Plugins [{{var0}}] kunde inte laddas",
							notice_new_plugins:					"Nya Plugins [{{var0}}] har lagts till i PluginRepo",
							notice_outdated_plugins:			"Vissa Plugins [{{var0}}] ??r f??r??ldrade"
						};
					case "th":		// Thai
						return {
							list:								"??????????????????",
							notice_failed_plugins:				"??????????????????????????????????????? Plugins [{{var0}}] ????????????????????????????????????",
							notice_new_plugins:					"??????????????? Plugins [{{var0}}] ?????????????????? PluginRepo ????????????",
							notice_outdated_plugins:			"Plugins [{{var0}}] ????????????????????????????????????????????????"
						};
					case "tr":		// Turkish
						return {
							list:								"Liste",
							notice_failed_plugins:				"Baz?? Plugins [{{var0}}] y??klenemedi",
							notice_new_plugins:					"Yeni Plugins [{{var0}}], PluginRepo 'ye eklendi",
							notice_outdated_plugins:			"Baz?? Plugins [{{var0}}] g??ncel de??il"
						};
					case "uk":		// Ukrainian
						return {
							list:								"????????????",
							notice_failed_plugins:				"?????????? Plugins [{{var0}}] ???? ?????????????? ??????????????????????",
							notice_new_plugins:					"???????? Plugins [{{var0}}] ???????? ???????????? ???? PluginRepo",
							notice_outdated_plugins:			"?????????? Plugins [{{var0}}] ??????????????????"
						};
					case "vi":		// Vietnamese
						return {
							list:								"Danh s??ch",
							notice_failed_plugins:				"Kh??ng th??? t???i m???t s??? Plugins [{{var0}}] ",
							notice_new_plugins:					"Plugins [{{var0}}] m???i ???? ???????c th??m v??o PluginRepo",
							notice_outdated_plugins:			"M???t s??? Plugins [{{var0}}] ???? l???i th???i"
						};
					case "zh-CN":	// Chinese (China)
						return {
							list:								"??????",
							notice_failed_plugins:				"?????? Plugins [{{var0}}] ????????????",
							notice_new_plugins:					"?????? Plugins [{{var0}}] ???????????? PluginRepo",
							notice_outdated_plugins:			"?????? Plugins [{{var0}}] ?????????"
						};
					case "zh-TW":	// Chinese (Taiwan)
						return {
							list:								"??????",
							notice_failed_plugins:				"?????? Plugins [{{var0}}] ????????????",
							notice_new_plugins:					"?????? Plugins [{{var0}}] ???????????? PluginRepo",
							notice_outdated_plugins:			"?????? Plugins [{{var0}}] ?????????"
						};
					default:		// English
						return {
							list:								"List",
							notice_failed_plugins:				"Some Plugins [{{var0}}] could not be loaded",
							notice_new_plugins:					"New Plugins [{{var0}}] have been added to the PluginRepo",
							notice_outdated_plugins:			"Some Plugins [{{var0}}] are outdated"
						};
				}
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(config));
})();