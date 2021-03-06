import React from 'react';
import PropTypes from 'prop-types';
import { View, FlatList } from 'react-native';
import { connect } from 'react-redux';
import SafeAreaView from 'react-native-safe-area-view';

import LoggedView from '../View';
import RCTextInput from '../../containers/TextInput';
import RCActivityIndicator from '../../containers/ActivityIndicator';
import styles from './styles';
import Markdown from '../../containers/message/Markdown';
import debounce from '../../utils/debounce';
import RocketChat from '../../lib/rocketchat';
import buildMessage from '../../lib/methods/helpers/buildMessage';
import Message from '../../containers/message';
import scrollPersistTaps from '../../utils/scrollPersistTaps';
import log from '../../utils/log';
import I18n from '../../i18n';
import { DEFAULT_HEADER } from '../../constants/headerOptions';

@connect(state => ({
	user: {
		id: state.login.user && state.login.user.id,
		username: state.login.user && state.login.user.username,
		token: state.login.user && state.login.user.token
	},
	baseUrl: state.settings.Site_Url || state.server ? state.server.server : ''
}))
/** @extends React.Component */
export default class SearchMessagesView extends LoggedView {
	static options() {
		return {
			...DEFAULT_HEADER,
			topBar: {
				...DEFAULT_HEADER.topBar,
				title: {
					...DEFAULT_HEADER.topBar.title,
					text: I18n.t('Search')
				}
			}
		};
	}

	static propTypes = {
		rid: PropTypes.string,
		componentId: PropTypes.string,
		user: PropTypes.object,
		baseUrl: PropTypes.string
	}

	constructor(props) {
		super('SearchMessagesView', props);
		this.limit = 0;
		this.state = {
			messages: [],
			searching: false,
			loadingMore: false
		};
	}

	componentDidMount() {
		this.name.focus();
	}

	componentWillUnmount() {
		this.onChangeSearch.stop();
	}

	onChangeSearch = debounce((search) => {
		const { searching } = this.state;

		this.searchText = search;
		this.limit = 0;
		if (!searching) {
			this.setState({ searching: true });
		}
		this.search();
	}, 1000)

	search = async() => {
		const { rid } = this.props;

		if (this._cancel) {
			this._cancel('cancel');
		}
		const cancel = new Promise((r, reject) => this._cancel = reject);
		let messages = [];
		try {
			const result = await Promise.race([RocketChat.messageSearch(this.searchText, rid, this.limit), cancel]);
			messages = result.message.docs.map(message => buildMessage(message));
			this.setState({ messages, searching: false, loadingMore: false });
		} catch (e) {
			this._cancel = null;
			if (e !== 'cancel') {
				return this.setState({ searching: false, loadingMore: false });
			}
			log('SearchMessagesView.search', e);
		}
	}

	moreData = () => {
		const { loadingMore, messages } = this.state;
		if (messages.length < this.limit) {
			return;
		}
		if (this.searchText && !loadingMore) {
			this.setState({ loadingMore: true });
			this.limit += 20;
			this.search();
		}
	}

	renderItem = ({ item }) => {
		const { user } = this.props;
		return (
			<Message
				item={item}
				style={styles.message}
				reactions={item.reactions}
				user={user}
				customTimeFormat='MMMM Do YYYY, h:mm:ss a'
				onReactionPress={async(emoji) => {
					try {
						await RocketChat.setReaction(emoji, item._id);
						this.search();
						this.forceUpdate();
					} catch (e) {
						log('SearchMessagesView.onReactionPress', e);
					}
				}}
			/>
		);
	}

	render() {
		const { searching, loadingMore, messages } = this.state;
		return (
			<SafeAreaView style={styles.container} testID='search-messages-view' forceInset={{ bottom: 'never' }}>
				<View style={styles.searchContainer}>
					<RCTextInput
						inputRef={(e) => { this.name = e; }}
						label={I18n.t('Search')}
						onChangeText={this.onChangeSearch}
						placeholder={I18n.t('Search_Messages')}
						testID='search-message-view-input'
					/>
					<Markdown msg={I18n.t('You_can_search_using_RegExp_eg')} username='' baseUrl='' customEmojis={{}} />
					<View style={styles.divider} />
				</View>
				<FlatList
					data={messages}
					renderItem={this.renderItem}
					style={styles.list}
					keyExtractor={item => item._id}
					onEndReached={this.moreData}
					ListHeaderComponent={searching ? <RCActivityIndicator /> : null}
					ListFooterComponent={loadingMore ? <RCActivityIndicator /> : null}
					{...scrollPersistTaps}
				/>
			</SafeAreaView>
		);
	}
}
