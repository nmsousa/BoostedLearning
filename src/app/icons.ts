/**
 * Register every Ionicons icon the app uses, as INLINE DATA, via `addIcons`.
 *
 * Why: the app was relying on Ionicons' runtime loader fetching each SVG from
 * `/svg/<name>.svg`. In some hosting contexts (a non-root base, a file://
 * preview, or certain WebViews) the loader can't build a valid base URL and
 * fails with "Failed to construct 'URL': Invalid base URL" — every icon then
 * renders blank. Registering the icons as data removes the fetch entirely, so
 * icons work the same in the browser, a static preview, and the native app.
 *
 * Keep this list in sync when adding new `ion-icon` names. `setAssetPath`
 * (in main.ts) still covers anything not registered here as a fallback.
 *
 * @module app/icons
 */

import { addIcons } from 'ionicons';
import {
  addCircleOutline, albumsOutline, alertCircle, alertCircleOutline,
  arrowBackOutline, arrowForward, arrowUpCircle, arrowUpCircleOutline,
  book, bookOutline, bulb, bulbOutline, calendarOutline, checkmark,
  checkmarkCircle, checkmarkCircleOutline, chevronBack, chevronDown,
  chevronForward, chevronForwardOutline, chevronUp, closeCircle, closeOutline,
  cloudDownloadOutline, cloudUploadOutline, colorPaletteOutline, compassOutline,
  constructOutline, createOutline, ellipse, ellipseOutline, ellipsisVertical,
  eyeOff, eyeOffOutline, flagOutline, flame, flameOutline, flash, flashOutline,
  footstepsOutline, gitCompareOutline, gitNetworkOutline, globeOutline, help, helpCircleOutline,
  hourglassOutline, informationCircle, informationCircleOutline, layersOutline,
  locateOutline, lockClosed, lockClosedOutline, mapOutline, personOutline, play,
  playSkipForwardOutline, refresh, refreshCircle, refreshOutline,
  removeCircleOutline, reorderFourOutline, schoolOutline, searchOutline,
  settingsOutline, shareOutline, sparklesOutline, speedometerOutline, star,
  starHalfOutline, starOutline, statsChart, swapHorizontalOutline,
  swapVerticalOutline, syncOutline, textOutline, thumbsDown, thumbsUp,
  timeOutline, trashOutline, trophy, trophyOutline, volumeHighOutline,
  volumeMuteOutline, locate,
} from 'ionicons/icons';

/** Call once at bootstrap (before Angular renders). */
export function registerAppIcons(): void {
  addIcons({
    // kebab-case name (what templates/data use)  →  imported SVG data
    'add-circle-outline': addCircleOutline,
    'albums-outline': albumsOutline,
    'alert-circle': alertCircle,
    'alert-circle-outline': alertCircleOutline,
    'arrow-back-outline': arrowBackOutline,
    'arrow-forward': arrowForward,
    'arrow-up-circle': arrowUpCircle,
    'arrow-up-circle-outline': arrowUpCircleOutline,
    book,
    'book-outline': bookOutline,
    bulb,
    'bulb-outline': bulbOutline,
    'calendar-outline': calendarOutline,
    checkmark,
    'checkmark-circle': checkmarkCircle,
    'checkmark-circle-outline': checkmarkCircleOutline,
    'chevron-back': chevronBack,
    'chevron-down': chevronDown,
    'chevron-forward': chevronForward,
    'chevron-forward-outline': chevronForwardOutline,
    'chevron-up': chevronUp,
    'close-circle': closeCircle,
    'close-outline': closeOutline,
    'cloud-download-outline': cloudDownloadOutline,
    'cloud-upload-outline': cloudUploadOutline,
    'color-palette-outline': colorPaletteOutline,
    'compass-outline': compassOutline,
    'construct-outline': constructOutline,
    'create-outline': createOutline,
    ellipse,
    'ellipse-outline': ellipseOutline,
    'ellipsis-vertical': ellipsisVertical,
    'eye-off': eyeOff,
    'eye-off-outline': eyeOffOutline,
    'flag-outline': flagOutline,
    flame,
    'flame-outline': flameOutline,
    flash,
    'flash-outline': flashOutline,
    'footsteps-outline': footstepsOutline,
    'git-compare-outline': gitCompareOutline,
    'git-network-outline': gitNetworkOutline,
    'globe-outline': globeOutline,
    help,
    'help-circle-outline': helpCircleOutline,
    'hourglass-outline': hourglassOutline,
    'information-circle': informationCircle,
    'information-circle-outline': informationCircleOutline,
    'layers-outline': layersOutline,
    locate,
    'locate-outline': locateOutline,
    'lock-closed': lockClosed,
    'lock-closed-outline': lockClosedOutline,
    'map-outline': mapOutline,
    'person-outline': personOutline,
    play,
    'play-skip-forward-outline': playSkipForwardOutline,
    refresh,
    'refresh-circle': refreshCircle,
    'refresh-outline': refreshOutline,
    'remove-circle-outline': removeCircleOutline,
    'reorder-four-outline': reorderFourOutline,
    'school-outline': schoolOutline,
    'search-outline': searchOutline,
    'settings-outline': settingsOutline,
    'share-outline': shareOutline,
    'sparkles-outline': sparklesOutline,
    'speedometer-outline': speedometerOutline,
    star,
    'star-half-outline': starHalfOutline,
    'star-outline': starOutline,
    'stats-chart': statsChart,
    'swap-horizontal-outline': swapHorizontalOutline,
    'swap-vertical-outline': swapVerticalOutline,
    'sync-outline': syncOutline,
    'text-outline': textOutline,
    'thumbs-down': thumbsDown,
    'thumbs-up': thumbsUp,
    'time-outline': timeOutline,
    'trash-outline': trashOutline,
    trophy,
    'trophy-outline': trophyOutline,
    'volume-high-outline': volumeHighOutline,
    'volume-mute-outline': volumeMuteOutline,
  });
}
