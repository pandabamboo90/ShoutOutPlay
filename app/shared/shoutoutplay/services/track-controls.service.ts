// angular
import {Injectable} from '@angular/core';

// nativescript
import {isIOS} from 'platform';
import {TNSSpotifyAuth} from 'nativescript-spotify';
import * as socialShare from "nativescript-social-share";

// libs
import {Store} from '@ngrx/store';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {Subscription} from 'rxjs/Subscription';
import 'rxjs/add/operator/take';

// app
import {LogService, Config} from '../../core/index';
import {ShoutoutModel} from '../models/shoutout.model';
import {TrackModel} from '../models/track.model';
import {PlayerService, IPlayerState, PLAYER_ACTIONS} from './player.service';
import {PlaylistService} from './playlist.service';
import {SearchService} from './search.service';

@Injectable()
export class TrackControlService {
  public playingIcon$: BehaviorSubject<string> = new BehaviorSubject('fa-play-circle');
  public isPreview$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  public showControls$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private _currentTrackId: string;
  private _sub: Subscription;

  constructor(private store: Store<any>, private logger: LogService, public player: PlayerService, public playlistService: PlaylistService, public searchService: SearchService) {
    player.state$.subscribe((state: IPlayerState) => {
      this._currentTrackId = state.currentTrackId;
      this.isPreview$.next(state.activeList == 'search');
      this.playingIcon$.next(state.playing ? 'fa-pause-circle' : 'fa-play-circle');
      let showControls = this._currentTrackId ? true : false;
      this.showControls$.next(showControls);
      this.logger.debug(`showControls: ${showControls}`);
      // if (!showControls) {
      //   // when cleared
      //   this.player.currentTrack$.next(null);
      // }
    });
  }

  public togglePlay() {
    if (PlayerService.isPreview) {
      this.searchService.togglePreview({ id: this._currentTrackId, playing: PlayerService.isPlaying });
    } else {
      this.store.take(1).subscribe((state: any) => {
        this.store.dispatch({
          type: PLAYER_ACTIONS.LIST_TOGGLE_PLAY,
          payload: {
            activeList: state.player.activeList,
            trackId: this._currentTrackId,
            activeShoutOutPath: state.player.activeShoutOutPath
          }
        });
      });
    }
  }

  public openShareOptions(shoutout?: ShoutoutModel, track?: TrackModel) {

    let prepareShare = (t: any) => {
      let msg = '';
      if (shoutout) {
        if (TNSSpotifyAuth.SESSION) {
          TNSSpotifyAuth.CURRENT_USER().then((user: any) => {
            let displayName = isIOS ? user.displayName : user.display_name;
            this.shareShoutOut(shoutout, t, displayName);
          });
        } else {
          this.shareShoutOut(shoutout, t);
        }
      } else {
        this.shareTrack(t);
      }
    };

    if (track) {
      prepareShare(track);
    } else {
      this.player.currentTrack$.take(1).subscribe((t: any) => {
        let uriParts = t.uri.split(':');
        let trackId = uriParts[uriParts.length - 1];
        prepareShare({ id: trackId, name: t.trackName });
      });
    }
  }

  private shareShoutOut(shoutout: ShoutoutModel, track: any, displayName?: string) {
    let timestamp = shoutout.filename.split('-').slice(-1)[0].replace('.m4a','');
    if (displayName) {
      displayName = displayName.split(' ')[0];
    } else {
      displayName = 'Anonymous';
    }
    let url = `https://shoutoutplay.com/?n=${displayName}&u=${Config.USER_KEY}&ti=${timestamp}&t=${track.id}`;
    let msg = `Yo, here's a ShoutOut for ya, '${track.name}' :)\n
${url}`;
    this.shareText(msg, `Yo, this ShoutOut is for you!`);
  }

  private shareTrack(track: any) {
    let msg = `Check out this track '${track.name}':\n
https://open.spotify.com/track/${track.id}\n
Enjoyed with ShoutOutPlay, download here:\n
${this.appLink()}`;
    this.shareText(msg, 'Check out this track I enjoyed with ShoutOutPlay!');
  }

  private appLink(): string {
    return isIOS ? 'https://itunes.apple.com/us/app/shoutoutplay/id1130768471?mt=8' : 'https://play.google.com/store/apps/details?id=com.wwwalkerrun.ShoutOutPlay';
  }

  private shareText(msg: string, subject: string) {
    this.logger.debug(msg);
    socialShare.shareText(msg, subject);
  }
}