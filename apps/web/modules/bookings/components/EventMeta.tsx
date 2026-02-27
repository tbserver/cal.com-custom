import { Timezone as PlatformTimezoneSelect } from "@calcom/atoms/timezone";
import { useBookerStoreContext } from "@calcom/features/bookings/Booker/BookerStoreProvider";
import { useBookerTime } from "@calcom/features/bookings/Booker/hooks/useBookerTime";
import { fadeInUp } from "@calcom/features/bookings/Booker/config";
import type { Timezone } from "@calcom/features/bookings/Booker/types";
import { FromToTime } from "@calcom/features/bookings/Booker/utils/dates";
import { useTimePreferences } from "@calcom/features/bookings/lib";
import type { BookerEvent } from "@calcom/features/bookings/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { markdownToSafeHTMLClient } from "@calcom/lib/markdownToSafeHTMLClient";
import { CURRENT_TIMEZONE } from "@calcom/lib/timezoneConstants";
import type { EventTypeTranslation } from "@calcom/prisma/client";
import { EventTypeAutoTranslatedField } from "@calcom/prisma/enums";
import { EventMetaBlock } from "@calcom/web/modules/bookings/components/event-meta/Details";
import { SeatsAvailabilityText } from "@calcom/web/modules/bookings/components/SeatsAvailabilityText";
import { m } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { shallow } from "zustand/shallow";
import i18nConfigration from "../../../../../i18n.json";
import { EventDetailBlocks } from "@calcom/features/bookings/types";
import { EventDetails, EventMembers, EventMetaSkeleton, EventTitle } from "./event-meta";
import { ScrollableWithGradients } from "./ScrollableWithGradients";

const WebTimezoneSelect = dynamic(
  () => import("@calcom/web/modules/timezone/components/TimezoneSelect").then((mod) => mod.TimezoneSelect),
  {
    ssr: false,
  }
);

const getTranslatedField = (
  translations: Array<Pick<EventTypeTranslation, "field" | "targetLocale" | "translatedText">>,
  field: EventTypeAutoTranslatedField,
  userLocale: string
) => {
  const i18nLocales = i18nConfigration.locale.targets.concat([i18nConfigration.locale.source]);

  return translations?.find(
    (trans) =>
      trans.field === field &&
      i18nLocales.includes(trans.targetLocale) &&
      (userLocale === trans.targetLocale || userLocale.split("-")[0] === trans.targetLocale)
  )?.translatedText;
};

export const EventMeta = ({
  event,
  isPending,
  isPlatform = true,
  isPrivateLink,
  classNames,
  locale,
  timeZones,
  children,
  selectedTimeslot,
  roundRobinHideOrgAndTeam,
  hideOrgTeamAvatar,
  hideEventTypeDetails = false,
}: {
  event?: Pick<
    BookerEvent,
    | "lockTimeZoneToggleOnBookingPage"
    | "lockedTimeZone"
    | "schedule"
    | "seatsPerTimeSlot"
    | "subsetOfUsers"
    | "length"
    | "schedulingType"
    | "profile"
    | "entity"
    | "description"
    | "title"
    | "metadata"
    | "locations"
    | "currency"
    | "requiresConfirmation"
    | "recurringEvent"
    | "price"
    | "isDynamic"
    | "fieldTranslations"
    | "autoTranslateDescriptionEnabled"
    | "enablePerHostLocations"
  > | null;
  isPending: boolean;
  isPrivateLink: boolean;
  isPlatform?: boolean;
  classNames?: {
    eventMetaContainer?: string;
    eventMetaTitle?: string;
    eventMetaTimezoneSelect?: string;
    eventMetaChildren?: string;
  };
  locale?: string | null;
  timeZones?: Timezone[];
  children?: React.ReactNode;
  selectedTimeslot: string | null;
  roundRobinHideOrgAndTeam?: boolean;
  hideOrgTeamAvatar?: boolean;
  hideEventTypeDetails?: boolean;
}) => {
  const { timeFormat, timezone } = useBookerTime();
  const [setTimezone] = useTimePreferences((state) => [state.setTimezone]);
  const [setBookerStoreTimezone] = useBookerStoreContext((state) => [state.setTimezone], shallow);
  const selectedDuration = useBookerStoreContext((state) => state.selectedDuration);
  const bookerState = useBookerStoreContext((state) => state.state);
  const bookingData = useBookerStoreContext((state) => state.bookingData);
  const rescheduleUid = useBookerStoreContext((state) => state.rescheduleUid);
  const [seatedEventData, setSeatedEventData] = useBookerStoreContext(
    (state) => [state.seatedEventData, state.setSeatedEventData],
    shallow
  );
  const { i18n, t } = useLocale();
  const [TimezoneSelect] = useMemo(
    () => (isPlatform ? [PlatformTimezoneSelect] : [WebTimezoneSelect]),
    [isPlatform]
  );

  useEffect(() => {
    //In case the event has lockTimeZone enabled ,set the timezone to event's locked timezone
    if (event?.lockTimeZoneToggleOnBookingPage) {
      const timezone = event.lockedTimeZone || event.schedule?.timeZone;
      if (timezone) {
        setTimezone(timezone);
      }
    }
  }, [event, setTimezone]);

  if (hideEventTypeDetails) {
    return null;
  }
  // If we didn't pick a time slot yet, we load bookingData via SSR so bookingData should be set
  // Otherwise we load seatedEventData from useBookerStore
  const bookingSeatAttendeesQty = seatedEventData?.attendees || bookingData?.attendees.length;
  const eventTotalSeats = seatedEventData?.seatsPerTimeSlot || event?.seatsPerTimeSlot;

  const isHalfFull =
    bookingSeatAttendeesQty && eventTotalSeats && bookingSeatAttendeesQty / eventTotalSeats >= 0.5;
  const isNearlyFull =
    bookingSeatAttendeesQty && eventTotalSeats && bookingSeatAttendeesQty / eventTotalSeats >= 0.83;

  const colorClass = isNearlyFull
    ? "text-rose-600"
    : isHalfFull
      ? "text-yellow-500"
      : "text-bookinghighlight";
  const userLocale = locale ?? navigator.language;
  const translatedDescription = getTranslatedField(
    event?.fieldTranslations ?? [],
    EventTypeAutoTranslatedField.DESCRIPTION,
    userLocale
  );
  const translatedTitle = getTranslatedField(
    event?.fieldTranslations ?? [],
    EventTypeAutoTranslatedField.TITLE,
    userLocale
  );

  return (
    <div className={`${classNames?.eventMetaContainer || ""} relative z-10 p-6 text-center`} data-testid="event-meta">
      {isPending && (
        <m.div {...fadeInUp} initial="visible" layout>
          <EventMetaSkeleton />
        </m.div>
      )}
      {!isPending && !!event && (
        <m.div {...fadeInUp} layout transition={{ ...fadeInUp.transition, delay: 0.3 }}>

          {/* Custom braderie info block — top */}
          <div className="mb-4 px-4 py-3 text-sm leading-relaxed text-gray-700">
            <p className="mb-2 text-base font-bold uppercase text-gray-900">
              Merci pour votre inscription !
            </p>
            <p className="mb-3 text-gray-600">
              Vous allez recevoir un email avec toutes les informations de la braderie Tammy &amp; Benjamin.
            </p>
            <div className="border-t border-gray-200 pt-3">
              <p className="font-semibold text-gray-900">On se retrouve du 6 au 10 mars</p>
              <p className="mt-1">📍 33 Rue de Poitou, 75003 Paris</p>
              <p>🕐 Tous les jours de 12h à 19h30</p>
            </div>
          </div>

          {/* Hidden: avatar + "TAMMY & BENJAMIN - Braderie" + event title */}

          {(event.description || translatedDescription) && (
            <EventMetaBlock data-testid="event-meta-description" contentClassName="mb-8">
              <ScrollableWithGradients
                className="wrap-break-word scroll-bar max-h-[180px] max-w-full overflow-y-auto pr-4"
                ariaLabel={t("description")}>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized via markdownToSafeHTMLClient */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: markdownToSafeHTMLClient(translatedDescription ?? event.description),
                  }}
                />
              </ScrollableWithGradients>
            </EventMetaBlock>
          )}
          <div className="stack-y-4 font-medium rtl:-mr-2 flex flex-col items-center">
            {rescheduleUid && bookingData && (
              <EventMetaBlock icon="calendar">
                {t("former_time")}
                <br />
                <span className="line-through" data-testid="former_time_p">
                  <FromToTime
                    date={bookingData.startTime.toString()}
                    duration={null}
                    timeFormat={timeFormat}
                    timeZone={timezone}
                    language={i18n.language}
                  />
                </span>
              </EventMetaBlock>
            )}
            {selectedTimeslot && (
              <EventMetaBlock icon="calendar">
                <FromToTime
                  date={selectedTimeslot}
                  duration={selectedDuration || event.length}
                  timeFormat={timeFormat}
                  timeZone={timezone}
                  language={i18n.language}
                />
              </EventMetaBlock>
            )}
            <EventDetails event={event} blocks={[EventDetailBlocks.REQUIRES_CONFIRMATION, EventDetailBlocks.OCCURENCES, EventDetailBlocks.PRICE]} />
            {bookerState === "booking" && eventTotalSeats && bookingSeatAttendeesQty ? (
              <EventMetaBlock icon="user" className={`${colorClass}`}>
                <div className="text-bookinghighlight flex items-start text-sm">
                  <p>
                    <SeatsAvailabilityText
                      showExact={!!seatedEventData.showAvailableSeatsCount}
                      totalSeats={eventTotalSeats}
                      bookedSeats={bookingSeatAttendeesQty || 0}
                      variant="fraction"
                    />
                  </p>
                </div>
              </EventMetaBlock>
            ) : null}
          </div>
          {children && <div className={classNames?.eventMetaChildren}>{children}</div>}
        </m.div>
      )}
    </div>
  );
};
