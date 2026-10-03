#!/usr/bin/env python3
"""One-time content import: the public frilly.ai site -> effortless-rulebook.json.

The SCHEMA below is authored by hand (it is the rulebook). The DATA rows for
Listings / Events / Cities / Categories / Subcategories are loaded from the
per-page JSON + JSON-LD artifacts that frilly.ai publishes for every entity
(https://frilly.ai/llms.txt). Everything else (Sites, EntityTypes, Personas,
Routes, UserStories, AcceptanceCriteria, __meta__) is authored inline.

Usage:
    python3 scripts/import-frilly-scrape.py <scrape-dir> [--today YYYY-MM-DD]

Re-running is safe: it rewrites effortless-rulebook/effortless-rulebook.json
from the scrape. After the first import the rulebook is the source of truth;
edit it (or use the editor) rather than re-importing.
"""
import glob
import json
import os
import re
import sys
from collections import OrderedDict

SCRAPE = sys.argv[1] if len(sys.argv) > 1 else "scrape"
TODAY = "2026-10-03"
if "--today" in sys.argv:
    TODAY = sys.argv[sys.argv.index("--today") + 1]
OUT = os.path.join(os.path.dirname(__file__), "..", "effortless-rulebook", "effortless-rulebook.json")


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s or "none"


def f(name, datatype, type_="raw", nullable=False, description="", formula=None, related=None):
    d = OrderedDict(name=name, datatype=datatype, type=type_, nullable=nullable, Description=description)
    if formula:
        d["formula"] = formula
    if related:
        d["RelatedTo"] = related
    return d


def lookup(name, datatype, fk, table, field, description):
    return f(name, datatype, "lookup", True, description,
             formula=f"=INDEX({table}!{{{{{field}}}}}, MATCH({{{{{fk}}}}}, {table}!{{{{{table[:-1] if table != 'Categories' else 'Category'}Id}}}}, 0))")


def lk(name, datatype, fk, table, field, key, description):
    """lookup with an explicit key field name on the parent table"""
    return f(name, datatype, "lookup", True, description,
             formula=f"=INDEX({table}!{{{{{field}}}}}, MATCH({{{{{fk}}}}}, {table}!{{{{{key}}}}}, 0))")


def count(name, table, fk_field, my_key, description, extra=""):
    return f(name, "integer", "aggregation", True, description,
             formula=f"=COUNTIFS({table}!{{{{{fk_field}}}}}, {{{{{my_key}}}}}{extra})")


def calc(name, datatype, formula, description, nullable=True):
    return f(name, datatype, "calculated", nullable, description, formula=formula)


# --------------------------------------------------------------------------
# SCHEMA
# --------------------------------------------------------------------------
schema = OrderedDict()

schema["Sites"] = dict(
    Description="The directory product itself (one row: Frilly). Global settings that other tables read through a lookup, so nothing is hard-coded in a formula.",
    schema=[
        f("SiteId", "string", description="Stable slug for the site (frilly)."),
        f("Title", "string", description="Brand name shown in the header and page titles."),
        f("Tagline", "string", description="The hero line on the home page."),
        f("BaseUrl", "string", description="Public origin, no trailing slash. Every absolute URL in the rulebook is derived from it."),
        f("Today", "string", description="The current date (YYYY-MM-DD) as the site sees it. Events compare their date to this to decide if they are upcoming. Bump it to move time forward."),
        f("FeaturedLimit", "integer", description="How many featured listings the home page shows."),
        f("JoinUrl", "string", description="Where the 'Join Now' call to action points."),
        f("VisionUrl", "string", description="Where the 'Vision' nav link points."),
        calc("Name", "string", "={{Title}}", "Display alias (mirrors Title)."),
        calc("Headline", "string", "={{Title}} & \" - \" & {{Tagline}}", "Browser-tab title: brand plus tagline."),
        count("CountOfCities", "Cities", "Site", "SiteId", "How many cities this site covers."),
        count("CountOfListings", "Listings", "Site", "SiteId", "Total listings (businesses + organizations + individuals) on the site."),
        count("CountOfEvents", "Events", "Site", "SiteId", "Total events known to the site."),
        count("CountOfPublishedListings", "Listings", "Site", "SiteId", "Listings that are live on the public site.", ", Listings!{{IsPublished}}, TRUE()"),
        count("CountOfUpcomingEvents", "Events", "Site", "SiteId", "Events on or after Today.", ", Events!{{IsUpcoming}}, TRUE()"),
        calc("IsLive", "boolean", "={{CountOfPublishedListings}} > 0", "The site has something to show."),
    ],
    data=[OrderedDict(SiteId="frilly", Title="Frilly", Tagline="Find your next local favorite.",
                      BaseUrl="https://frilly.ai", Today=TODAY, FeaturedLimit=5,
                      JoinUrl="https://frilly.ai/join", VisionUrl="https://frilly.ai/vision")],
)

schema["Cities"] = dict(
    Description="A city the directory covers. The URL prefix (/wisconsin/madison) is derived here once and every listing and event reads it.",
    schema=[
        f("CityId", "string", description="Slug: <city>-<state> e.g. madison-wi."),
        f("Site", "string", "relationship", description="The site this city belongs to.", related="Sites"),
        f("StateSlug", "string", description="URL segment for the state (wisconsin)."),
        f("CitySlug", "string", description="URL segment for the city (madison)."),
        f("CityName", "string", description="Display name (Madison)."),
        f("StateCode", "string", description="Two-letter state code (WI)."),
        calc("Name", "string", "={{CityName}} & \", \" & {{StateCode}}", "Display alias: Madison, WI."),
        calc("PathPrefix", "string", "=\"/\" & {{StateSlug}} & \"/\" & {{CitySlug}}", "URL prefix every entity in this city hangs under."),
        lk("SiteBaseUrl", "string", "Site", "Sites", "BaseUrl", "SiteId", "The site origin, pulled from Sites."),
        calc("DirectoryUrl", "string", "={{SiteBaseUrl}} & {{PathPrefix}}", "Absolute URL of this city's directory root."),
        count("CountOfListings", "Listings", "City", "CityId", "All listings located in this city."),
        count("CountOfBusinesses", "Listings", "City", "CityId", "Listings of type business.", ", Listings!{{IsBusiness}}, TRUE()"),
        count("CountOfOrganizations", "Listings", "City", "CityId", "Listings of type organization.", ", Listings!{{IsOrganization}}, TRUE()"),
        count("CountOfIndividuals", "Listings", "City", "CityId", "Listings of type individual maker.", ", Listings!{{IsIndividual}}, TRUE()"),
        count("CountOfEvents", "Events", "City", "CityId", "All events in this city."),
        count("CountOfUpcomingEvents", "Events", "City", "CityId", "Events in this city on or after the site's Today.", ", Events!{{IsUpcoming}}, TRUE()"),
        calc("HasEvents", "boolean", "={{CountOfUpcomingEvents}} > 0", "Whether the city page should show an events section."),
        calc("IsPrimaryMarket", "boolean", "={{CountOfListings}} >= 100", "A city with enough listings to be a headline market."),
    ],
    data=[],
)

schema["EntityTypes"] = dict(
    Description="The three kinds of listing the site publishes, with the URL segment each uses (/b, /o, /i).",
    schema=[
        f("EntityTypeId", "string", description="business | organization | individual."),
        f("Label", "string", description="Singular display label."),
        f("PluralLabel", "string", description="Plural display label used for section headings."),
        f("UrlSegment", "string", description="Single-letter URL segment (b, o, i)."),
        f("SortOrder", "integer", description="Order in navigation."),
        f("Blurb", "string", description="One-line description used on the directory landing page."),
        calc("Name", "string", "={{Label}}", "Display alias."),
        count("CountOfListings", "Listings", "EntityType", "EntityTypeId", "Listings of this type."),
        calc("ListPathSegment", "string", "=\"/\" & {{UrlSegment}}", "The path piece inserted between the city prefix and the slug."),
        calc("SectionTitle", "string", "={{PluralLabel}} & \" (\" & {{CountOfListings}} & \")\"", "Heading with a live count."),
    ],
    data=[
        OrderedDict(EntityTypeId="business", Label="Business", PluralLabel="Businesses", UrlSegment="b", SortOrder=1, Blurb="Restaurants, retail, services"),
        OrderedDict(EntityTypeId="organization", Label="Organization", PluralLabel="Organizations", UrlSegment="o", SortOrder=2, Blurb="Nonprofits, coworking spaces, community groups"),
        OrderedDict(EntityTypeId="individual", Label="Individual Maker", PluralLabel="Individual Makers", UrlSegment="i", SortOrder=3, Blurb="Artists, craftspeople, freelancers"),
    ],
)

schema["Categories"] = dict(
    Description="Top-level category a listing belongs to (Food & Hospitality, Entertainment, ...).",
    schema=[
        f("CategoryId", "string", description="Slug of the category title."),
        f("Title", "string", description="Display title."),
        calc("Name", "string", "={{Title}}", "Display alias."),
        count("CountOfListings", "Listings", "Category", "CategoryId", "Listings in this category."),
        count("CountOfSubcategories", "Subcategories", "Category", "CategoryId", "Subcategories under this category."),
        calc("IsPopular", "boolean", "={{CountOfListings}} >= 25", "Shown in the 'Top Categories' strip."),
        calc("MenuLabel", "string", "={{Title}} & \" (\" & {{CountOfListings}} & \")\"", "Label with a live count for filters."),
    ],
    data=[],
)

schema["Subcategories"] = dict(
    Description="Second-level category (Deli & Bakery under Food & Hospitality).",
    schema=[
        f("SubcategoryId", "string", description="Slug: <category>--<subcategory>."),
        f("Category", "string", "relationship", description="Parent category.", related="Categories"),
        f("Title", "string", description="Display title."),
        calc("Name", "string", "={{Title}}", "Display alias."),
        lk("CategoryTitle", "string", "Category", "Categories", "Title", "CategoryId", "Parent category title."),
        calc("FullTitle", "string", "={{CategoryTitle}} & \" | \" & {{Title}}", "Breadcrumb-style label used in listing cards."),
        count("CountOfListings", "Listings", "Subcategory", "SubcategoryId", "Listings in this subcategory."),
        calc("IsEmpty", "boolean", "={{CountOfListings}} = 0", "A subcategory no listing uses (safe to retire)."),
    ],
    data=[],
)

schema["Listings"] = dict(
    Description="A business, organization or individual maker page on the public site. Raw fields are what the editor types; everything about URLs, completeness and event rollups is derived.",
    schema=[
        f("ListingId", "string", description="URL slug (bloom-bake-shop)."),
        f("Site", "string", "relationship", description="Owning site.", related="Sites"),
        f("City", "string", "relationship", description="City the listing is located in.", related="Cities"),
        f("EntityType", "string", "relationship", description="business | organization | individual.", related="EntityTypes"),
        f("Category", "string", "relationship", description="Top-level category.", related="Categories"),
        f("Subcategory", "string", "relationship", description="Second-level category.", related="Subcategories"),
        f("Title", "string", description="Display name."),
        f("Description", "string", description="Long-form description shown on the detail page."),
        f("Tags", "string", description="Comma-separated tags (deli,bakery,sandwiches)."),
        f("Phone", "string", description="Phone number as displayed; empty if unknown."),
        f("Email", "string", description="Contact email; empty if unknown."),
        f("Website", "string", description="External website URL; empty if unknown."),
        f("Instagram", "string", description="Instagram URL; empty if unknown."),
        f("Street", "string", description="Street address line."),
        f("ZipCode", "string", description="Postal code."),
        f("Latitude", "number", description="Latitude; 0 when unknown."),
        f("Longitude", "number", description="Longitude; 0 when unknown."),
        f("LogoUrl", "string", description="Logo image URL; empty if none."),
        f("IsFeatured", "boolean", description="Shown in the home page 'Featured today' strip."),
        f("IsPublished", "boolean", description="Visible on the public site."),
        f("LastUpdated", "string", description="ISO timestamp of the last content change (from the source site)."),
        f("SourceId", "string", description="The id the current site uses for this record (for reconciliation)."),
        calc("Name", "string", "={{Title}}", "Display alias."),
        lk("CityPathPrefix", "string", "City", "Cities", "PathPrefix", "CityId", "URL prefix from the city."),
        lk("CityName", "string", "City", "Cities", "Name", "CityId", "City, ST for display."),
        lk("EntityTypeSegment", "string", "EntityType", "EntityTypes", "UrlSegment", "EntityTypeId", "b / o / i."),
        lk("EntityTypeLabel", "string", "EntityType", "EntityTypes", "Label", "EntityTypeId", "Human label of the type."),
        lk("CategoryTitle", "string", "Category", "Categories", "Title", "CategoryId", "Category title for cards."),
        lk("SubcategoryTitle", "string", "Subcategory", "Subcategories", "Title", "SubcategoryId", "Subcategory title for cards."),
        lk("SiteBaseUrl", "string", "Site", "Sites", "BaseUrl", "SiteId", "Site origin."),
        calc("EntityPath", "string", "={{CityPathPrefix}} & \"/\" & {{EntityTypeSegment}} & \"/\" & {{ListingId}}", "Site-relative path of the page (/wisconsin/madison/b/bloom-bake-shop)."),
        calc("EntityUrl", "string", "={{SiteBaseUrl}} & {{EntityPath}}", "Absolute page URL."),
        calc("MarkdownUrl", "string", "={{EntityUrl}} & \".md\"", "The AI-readable markdown twin of the page."),
        calc("JsonUrl", "string", "={{EntityUrl}} & \".json\"", "The machine-readable JSON twin of the page."),
        calc("IsBusiness", "boolean", "={{EntityType}} = \"business\"", "Type flag."),
        calc("IsOrganization", "boolean", "={{EntityType}} = \"organization\"", "Type flag."),
        calc("IsIndividual", "boolean", "={{EntityType}} = \"individual\"", "Type flag."),
        calc("HasPhone", "boolean", "=LEN({{Phone}}) > 0", "Contact completeness."),
        calc("HasEmail", "boolean", "=LEN({{Email}}) > 0", "Contact completeness."),
        calc("HasWebsite", "boolean", "=LEN({{Website}}) > 0", "Contact completeness."),
        calc("HasAddress", "boolean", "=LEN({{Street}}) > 0", "Location completeness."),
        calc("HasCoordinates", "boolean", "=AND({{Latitude}} <> 0, {{Longitude}} <> 0)", "Can be placed on a map."),
        calc("HasLogo", "boolean", "=LEN({{LogoUrl}}) > 0", "Has artwork for the card."),
        calc("HasDescription", "boolean", "=LEN({{Description}}) > 40", "Has a real description, not a stub."),
        calc("CompletenessScore", "integer", "=IF({{HasPhone}}, 1, 0) + IF({{HasEmail}}, 1, 0) + IF({{HasWebsite}}, 1, 0) + IF({{HasAddress}}, 1, 0) + IF({{HasCoordinates}}, 1, 0) + IF({{HasLogo}}, 1, 0) + IF({{HasDescription}}, 1, 0)", "0-7: how many of the profile facets are filled in."),
        calc("CompletenessPercent", "integer", "=ROUND({{CompletenessScore}} / 7 * 100, 0)", "CompletenessScore as a percentage for the admin dashboard."),
        calc("IsComplete", "boolean", "={{CompletenessScore}} >= 5", "Good enough to feature."),
        calc("IsListable", "boolean", "=AND({{IsPublished}}, LEN({{Title}}) > 0)", "Appears in public lists."),
        calc("IsFeaturable", "boolean", "=AND({{IsListable}}, {{IsComplete}}, {{HasLogo}})", "Eligible for the featured strip (published, complete, has a logo)."),
        calc("IsFeaturedLive", "boolean", "=AND({{IsFeatured}}, {{IsFeaturable}})", "Actually shows in 'Featured today': flagged AND eligible."),
        calc("FullAddress", "string", "={{Street}} & \", \" & {{CityName}} & \" \" & {{ZipCode}}", "One-line postal address."),
        calc("ShortDescription", "string", "=LEFT({{Description}}, 160)", "Card-length excerpt."),
        calc("TagCount", "integer", "=IF(LEN({{Tags}}) = 0, 0, LEN({{Tags}}) - LEN(SUBSTITUTE({{Tags}}, \",\", \"\")) + 1)", "Number of tags."),
        calc("CardLabel", "string", "={{CategoryTitle}} & \" | \" & {{SubcategoryTitle}}", "The 'Food & Hospitality | Deli & Bakery' line under a card title."),
        calc("SearchText", "string", "=LOWER({{Title}} & \" \" & {{Tags}} & \" \" & {{CategoryTitle}} & \" \" & {{SubcategoryTitle}})", "Lower-cased haystack the search box matches against."),
        count("CountOfEvents", "Events", "Venue", "ListingId", "Events hosted at this listing."),
        count("CountOfUpcomingEvents", "Events", "Venue", "ListingId", "Upcoming events hosted here.", ", Events!{{IsUpcoming}}, TRUE()"),
        calc("IsVenue", "boolean", "={{CountOfEvents}} > 0", "Hosts events, so the detail page gets an events section."),
        calc("HasUpcomingEvents", "boolean", "={{CountOfUpcomingEvents}} > 0", "Show the 'Happening here' block."),
    ],
    data=[],
)

schema["Events"] = dict(
    Description="An event hosted at a listing (venue). Dates are stored as ISO strings; whether an event is upcoming is derived from the site's Today.",
    schema=[
        f("EventId", "string", description="URL slug (our-lady-peace-2026-10-05)."),
        f("Site", "string", "relationship", description="Owning site.", related="Sites"),
        f("City", "string", "relationship", description="City of the event.", related="Cities"),
        f("Venue", "string", "relationship", description="The listing hosting the event.", related="Listings"),
        f("Title", "string", description="Event name."),
        f("Description", "string", description="Long description."),
        f("StartsAt", "string", description="ISO local start (2026-10-05T18:30:00)."),
        f("EndsAt", "string", description="ISO local end; empty if unknown."),
        f("DoorTime", "string", description="Free-text door/show line (Doors: 6:30 pm | Show: 8:00 pm)."),
        f("Price", "string", description="Free-text price ($15 - $20, Free, TBA)."),
        f("EventKind", "string", description="schema.org type: Event, MusicEvent, TheaterEvent."),
        f("Keywords", "string", description="Comma-separated event categories (Concerts)."),
        f("Genres", "string", description="Comma-separated genres."),
        f("ImageUrl", "string", description="Poster image URL; empty if none."),
        f("SourceUrl", "string", description="Ticket / source page."),
        f("Status", "string", description="scheduled | cancelled | postponed."),
        calc("Name", "string", "={{Title}}", "Display alias."),
        lk("SiteToday", "string", "Site", "Sites", "Today", "SiteId", "The site's current date."),
        lk("SiteBaseUrl", "string", "Site", "Sites", "BaseUrl", "SiteId", "Site origin."),
        lk("CityPathPrefix", "string", "City", "Cities", "PathPrefix", "CityId", "URL prefix."),
        lk("VenueTitle", "string", "Venue", "Listings", "Title", "ListingId", "Venue name."),
        lk("VenueAddress", "string", "Venue", "Listings", "FullAddress", "ListingId", "Venue address line."),
        lk("VenueEntityPath", "string", "Venue", "Listings", "EntityPath", "ListingId", "Link back to the venue page."),
        calc("EventDate", "string", "=LEFT({{StartsAt}}, 10)", "YYYY-MM-DD."),
        calc("StartTime", "string", "=MID({{StartsAt}}, 12, 5)", "HH:MM."),
        calc("IsUpcoming", "boolean", "={{EventDate}} >= {{SiteToday}}", "On or after the site's Today."),
        calc("IsToday", "boolean", "={{EventDate}} = {{SiteToday}}", "Happening today."),
        calc("IsPast", "boolean", "=NOT({{IsUpcoming}})", "Already happened."),
        calc("IsCancelled", "boolean", "={{Status}} = \"cancelled\"", "Status flag."),
        calc("IsListable", "boolean", "=AND({{IsUpcoming}}, NOT({{IsCancelled}}))", "Shows in public event lists."),
        calc("IsFree", "boolean", "=OR({{Price}} = \"Free\", {{Price}} = \"FREE\", {{Price}} = \"$0\")", "No charge."),
        calc("HasPrice", "boolean", "=LEN({{Price}}) > 0", "A price line is known."),
        calc("PriceLabel", "string", "=IF({{HasPrice}}, {{Price}}, \"TBA\")", "What the card prints under 'Price:'."),
        calc("HasImage", "boolean", "=LEN({{ImageUrl}}) > 0", "Has a poster."),
        calc("HasEndTime", "boolean", "=LEN({{EndsAt}}) > 0", "End time known."),
        calc("IsMusic", "boolean", "={{EventKind}} = \"MusicEvent\"", "Concert-type event."),
        calc("EventPath", "string", "={{CityPathPrefix}} & \"/events/\" & {{EventId}}", "Site-relative path."),
        calc("EventUrl", "string", "={{SiteBaseUrl}} & {{EventPath}}", "Absolute URL."),
        calc("Headline", "string", "={{Title}} & \" at \" & {{VenueTitle}}", "Title plus venue."),
        calc("WhenLabel", "string", "={{EventDate}} & \" | \" & {{DoorTime}}", "Date plus doors line."),
        calc("ShortDescription", "string", "=LEFT({{Description}}, 160)", "Card excerpt."),
    ],
    data=[],
)

schema["Personas"] = dict(
    Description="Who uses the app. Each user story and route is owned by one persona.",
    schema=[
        f("PersonaId", "string", description="visitor | admin."),
        f("Title", "string", description="Display name."),
        f("Description", "string", description="Who they are and what they want."),
        f("CanEdit", "boolean", description="May change rulebook data through the app."),
        f("HomePath", "string", description="Where the app lands after the simulated login."),
        f("DisplayName", "string", description="Name shown in the header when signed in as this persona."),
        calc("Name", "string", "={{Title}}", "Display alias."),
        calc("IsAdmin", "boolean", "={{CanEdit}}", "Admin personas see the admin area."),
        count("CountOfRoutes", "Routes", "Persona", "PersonaId", "Screens this persona can open."),
        count("CountOfUserStories", "UserStories", "Persona", "PersonaId", "Stories written for this persona."),
        count("CountOfBuiltUserStories", "UserStories", "Persona", "PersonaId", "Stories already built.", ", UserStories!{{IsBuilt}}, TRUE()"),
        calc("BuildProgressPercent", "integer", "=IF({{CountOfUserStories}} = 0, 0, ROUND({{CountOfBuiltUserStories}} / {{CountOfUserStories}} * 100, 0))", "How much of this persona's experience exists."),
    ],
    data=[
        OrderedDict(PersonaId="visitor", Title="Visitor", Description="Someone exploring Madison who wants to find a local favorite or something to do this week.", CanEdit=False, HomePath="/", DisplayName="Guest"),
        OrderedDict(PersonaId="admin", Title="Directory Admin", Description="The Frilly team member who curates listings, features businesses, keeps events current and watches data quality.", CanEdit=True, HomePath="/admin", DisplayName="Frilly Admin"),
    ],
)

schema["Routes"] = dict(
    Description="The app's navigation as data. The UI renders whatever rows exist here; adding a screen is adding a row.",
    schema=[
        f("RouteId", "string", description="Stable key (home, listing-detail, admin-listings)."),
        f("Persona", "string", "relationship", description="Persona that may open this route.", related="Personas"),
        f("Pattern", "string", description="React-router path pattern."),
        f("Label", "string", description="Nav label."),
        f("Area", "string", description="public | admin."),
        f("Component", "string", description="Component key the UI maps to a screen."),
        f("SortOrder", "integer", description="Order in navigation."),
        f("ShowInNav", "boolean", description="Appears in the header / sidebar."),
        f("IsImplemented", "boolean", description="A real screen exists (false renders a self-describing placeholder)."),
        f("Description", "string", description="What the screen is for."),
        calc("Name", "string", "={{Area}} & \":\" & {{Pattern}}", "Display alias."),
        lk("PersonaTitle", "string", "Persona", "Personas", "Title", "PersonaId", "Owning persona."),
        calc("IsAdminRoute", "boolean", "={{Area}} = \"admin\"", "Needs the admin persona."),
        count("CountOfUserStories", "UserStories", "Route", "RouteId", "Stories that land on this screen."),
        calc("IsCovered", "boolean", "={{CountOfUserStories}} > 0", "Has at least one story (and therefore a conformance test)."),
        calc("NavLabel", "string", "=IF({{IsAdminRoute}}, \"Admin: \", \"\") & {{Label}}", "Label as the nav prints it."),
    ],
    data=[
        OrderedDict(RouteId="home", Persona="visitor", Pattern="/", Label="Home", Area="public", Component="Home", SortOrder=1, ShowInNav=True, IsImplemented=True, Description="Hero, featured listings, this week's events."),
        OrderedDict(RouteId="directory", Persona="visitor", Pattern="/:state/:city", Label="Directory", Area="public", Component="Directory", SortOrder=2, ShowInNav=True, IsImplemented=True, Description="Browse and search every published listing in a city, by type and category."),
        OrderedDict(RouteId="listing-detail", Persona="visitor", Pattern="/:state/:city/:seg/:slug", Label="Listing", Area="public", Component="ListingDetail", SortOrder=3, ShowInNav=False, IsImplemented=True, Description="One business / organization / maker page with contact, address, tags and upcoming events."),
        OrderedDict(RouteId="events", Persona="visitor", Pattern="/:state/:city/events", Label="Events", Area="public", Component="Events", SortOrder=4, ShowInNav=True, IsImplemented=True, Description="Upcoming events in the city, soonest first."),
        OrderedDict(RouteId="event-detail", Persona="visitor", Pattern="/:state/:city/events/:slug", Label="Event", Area="public", Component="EventDetail", SortOrder=5, ShowInNav=False, IsImplemented=True, Description="One event with when, where, price and the venue link."),
        OrderedDict(RouteId="login", Persona="visitor", Pattern="/login", Label="Sign in", Area="public", Component="Login", SortOrder=9, ShowInNav=True, IsImplemented=True, Description="Simulated SaaS sign-in: pick a persona."),
        OrderedDict(RouteId="admin-dashboard", Persona="admin", Pattern="/admin", Label="Dashboard", Area="admin", Component="AdminDashboard", SortOrder=10, ShowInNav=True, IsImplemented=True, Description="Live counts and data-quality rollups straight from derived fields."),
        OrderedDict(RouteId="admin-listings", Persona="admin", Pattern="/admin/listings", Label="Listings", Area="admin", Component="AdminListings", SortOrder=11, ShowInNav=True, IsImplemented=True, Description="Search, filter, feature, publish and edit listings."),
        OrderedDict(RouteId="admin-listing-edit", Persona="admin", Pattern="/admin/listings/:slug", Label="Edit listing", Area="admin", Component="AdminListingEdit", SortOrder=12, ShowInNav=False, IsImplemented=True, Description="Edit one listing's raw fields; derived fields update on save."),
        OrderedDict(RouteId="admin-events", Persona="admin", Pattern="/admin/events", Label="Events", Area="admin", Component="AdminEvents", SortOrder=13, ShowInNav=True, IsImplemented=True, Description="Upcoming vs past, cancel, edit."),
        OrderedDict(RouteId="admin-categories", Persona="admin", Pattern="/admin/categories", Label="Categories", Area="admin", Component="AdminCategories", SortOrder=14, ShowInNav=True, IsImplemented=True, Description="Categories and subcategories with live listing counts."),
        OrderedDict(RouteId="admin-stories", Persona="admin", Pattern="/admin/stories", Label="User stories", Area="admin", Component="AdminStories", SortOrder=15, ShowInNav=True, IsImplemented=True, Description="Personas, routes, user stories and acceptance criteria, as stored in the rulebook."),
        OrderedDict(RouteId="admin-settings", Persona="admin", Pattern="/admin/settings", Label="Site settings", Area="admin", Component="AdminSettings", SortOrder=16, ShowInNav=True, IsImplemented=True, Description="Edit the Sites row: tagline, Today, featured limit."),
    ],
)

schema["UserStories"] = dict(
    Description="What each persona needs to be able to do. Every story has a TestKey the conformance suite runs.",
    schema=[
        f("UserStoryId", "string", description="US-01 style key."),
        f("Persona", "string", "relationship", description="Who the story is for.", related="Personas"),
        f("Route", "string", "relationship", description="Screen where the story is satisfied.", related="Routes"),
        f("Title", "string", description="Short title."),
        f("IWant", "string", description="The 'I want ...' clause."),
        f("SoThat", "string", description="The 'so that ...' clause."),
        f("Priority", "integer", description="1 = must, 2 = should, 3 = could."),
        f("Status", "string", description="planned | built."),
        f("TestKey", "string", description="Key the conformance suite uses to find this story's test."),
        calc("Name", "string", "={{UserStoryId}} & \" \" & {{Title}}", "Display alias."),
        lk("PersonaTitle", "string", "Persona", "Personas", "Title", "PersonaId", "Persona name."),
        lk("RoutePattern", "string", "Route", "Routes", "Pattern", "RouteId", "Where it lives."),
        calc("Statement", "string", "=\"As a \" & {{PersonaTitle}} & \", I want \" & {{IWant}} & \" so that \" & {{SoThat}} & \".\"", "The full user story sentence."),
        calc("IsBuilt", "boolean", "={{Status}} = \"built\"", "Done flag."),
        calc("IsMustHave", "boolean", "={{Priority}} = 1", "Priority flag."),
        count("CountOfAcceptanceCriteria", "AcceptanceCriteria", "UserStory", "UserStoryId", "How many criteria define done."),
        calc("IsTestable", "boolean", "={{CountOfAcceptanceCriteria}} > 0", "Has at least one criterion."),
    ],
    data=[],
)

schema["AcceptanceCriteria"] = dict(
    Description="Given / When / Then criteria for a user story. The conformance suite asserts each one.",
    schema=[
        f("AcceptanceCriterionId", "string", description="US-01-AC1 style key."),
        f("UserStory", "string", "relationship", description="Parent story.", related="UserStories"),
        f("Given", "string", description="Precondition."),
        f("When", "string", description="Action."),
        f("Then", "string", description="Expected outcome."),
        f("SortOrder", "integer", description="Order within the story."),
        calc("Name", "string", "={{AcceptanceCriterionId}}", "Display alias."),
        lk("UserStoryTitle", "string", "UserStory", "UserStories", "Title", "UserStoryId", "Parent story title."),
        calc("Statement", "string", "=\"Given \" & {{Given}} & \", when \" & {{When}} & \", then \" & {{Then}} & \".\"", "Full sentence."),
    ],
    data=[],
)

# --------------------------------------------------------------------------
# USER STORIES + ACCEPTANCE CRITERIA
# --------------------------------------------------------------------------
stories = [
    ("US-01", "visitor", "home", "See featured listings", "to see today's featured local businesses on the home page", "I can discover a new favorite quickly", 1,
     [("the home page is open", "it loads", "featured listings are shown with name and subcategory"),
      ("a listing is not published or not featured", "the home page loads", "it does not appear in the featured strip")]),
    ("US-02", "visitor", "home", "See this week's events", "to see upcoming events on the home page", "I know what is happening this week", 1,
     [("there are upcoming events", "the home page loads", "events are listed soonest first with date, doors, price and venue"),
      ("an event is in the past", "the home page loads", "it is not shown")]),
    ("US-03", "visitor", "directory", "Browse the directory", "to browse all published listings in a city by type", "I can find businesses, organizations and makers", 1,
     [("the Madison directory is open", "I pick Businesses", "only published business listings are shown"),
      ("the directory is open", "I look at the counts", "they match the number of published listings of each type")]),
    ("US-04", "visitor", "directory", "Search listings", "to search listings by name, tag or category", "I can find a specific place fast", 1,
     [("the directory is open", "I type 'bakery'", "listings whose name, tags or category mention bakery are shown")]),
    ("US-05", "visitor", "listing-detail", "View a listing", "to open a listing and see its description, contact, address and tags", "I can decide whether to visit", 1,
     [("I open /wisconsin/madison/b/bloom-bake-shop", "the page loads", "I see the title, category line, description, phone, website and address"),
      ("the listing hosts upcoming events", "the page loads", "those events are listed on the page")]),
    ("US-06", "visitor", "events", "Browse events", "to see every upcoming event in the city", "I can plan my week", 1,
     [("the events page is open", "it loads", "only upcoming, non-cancelled events are shown, soonest first")]),
    ("US-07", "visitor", "event-detail", "View an event", "to open an event and see when, where, price and the venue", "I can decide to go", 2,
     [("I open an event page", "it loads", "I see title, date, doors line, price label, venue name, venue address and source link")]),
    ("US-08", "visitor", "login", "Sign in", "to sign in as a persona", "the app behaves like a real SaaS product with roles", 1,
     [("I am on the sign-in page", "I choose Directory Admin", "I land on the admin dashboard"),
      ("I am signed out", "I open /admin", "I am sent to sign in")]),
    ("US-09", "admin", "admin-dashboard", "See the dashboard", "to see live counts of listings, events and data quality", "I know the state of the directory at a glance", 1,
     [("I am signed in as admin", "I open the dashboard", "counts of listings, published listings, upcoming events and cities are shown from the rulebook"),
      ("some listings are incomplete", "I open the dashboard", "the number of incomplete listings is shown")]),
    ("US-10", "admin", "admin-listings", "Manage listings", "to search and filter all listings including unpublished ones", "I can curate the directory", 1,
     [("I am on admin listings", "I filter to unpublished", "only unpublished listings are shown"),
      ("I am on admin listings", "I search by name", "matching listings appear")]),
    ("US-11", "admin", "admin-listings", "Feature a listing", "to toggle whether a listing is featured", "the home page highlights the right places", 1,
     [("a listing is featurable", "I switch IsFeatured on", "it appears in the public featured strip"),
      ("a listing has no logo", "I switch IsFeatured on", "IsFeaturedLive stays false and it is not shown publicly")]),
    ("US-12", "admin", "admin-listings", "Publish or unpublish", "to publish or unpublish a listing", "I control what the public sees", 1,
     [("a listing is published", "I unpublish it", "it disappears from the public directory and the published count drops by one")]),
    ("US-13", "admin", "admin-listing-edit", "Edit a listing", "to edit a listing's contact and address fields", "the derived completeness score updates automatically", 1,
     [("a listing has no phone", "I add a phone and save", "HasPhone becomes true and CompletenessScore increases by one"),
      ("I edit a listing", "I try to write a derived field", "the API rejects the write")]),
    ("US-14", "admin", "admin-events", "Manage events", "to see upcoming and past events and cancel one", "the public calendar stays accurate", 2,
     [("an event is upcoming", "I set its Status to cancelled", "IsListable becomes false and it leaves the public events page")]),
    ("US-15", "admin", "admin-categories", "See categories", "to see categories and subcategories with live listing counts", "I can tidy the taxonomy", 2,
     [("I open categories", "it loads", "each category shows its count of listings and subcategories")]),
    ("US-16", "admin", "admin-stories", "See user stories", "to see personas, routes, stories and acceptance criteria", "the product definition is visible inside the product", 2,
     [("I open user stories", "it loads", "every story statement is shown, grouped by persona, with its criteria")]),
    ("US-17", "admin", "admin-settings", "Edit site settings", "to change the tagline, Today and featured limit", "the whole site follows one settings row", 2,
     [("I change Today", "I save", "events' IsUpcoming flags recompute")]),
    ("US-18", "admin", "admin-dashboard", "Verify derived-field ratio", "to see what share of the schema is derived", "I can prove the rulebook does the work", 3,
     [("I open the dashboard", "it loads", "the derived-field percentage is shown and is at least 50")]),
]
for sid, persona, route, title, iwant, sothat, prio, acs in stories:
    schema["UserStories"]["data"].append(OrderedDict(
        UserStoryId=sid, Persona=persona, Route=route, Title=title, IWant=iwant, SoThat=sothat,
        Priority=prio, Status="built", TestKey=sid.lower()))
    for i, (g, w, t) in enumerate(acs, 1):
        schema["AcceptanceCriteria"]["data"].append(OrderedDict(
            AcceptanceCriterionId=f"{sid}-AC{i}", UserStory=sid, Given=g, When=w, Then=t, SortOrder=i))

# --------------------------------------------------------------------------
# DATA FROM THE SCRAPE
# --------------------------------------------------------------------------
cities = OrderedDict()
cats = OrderedDict()
subs = OrderedDict()
listing_ids = set()


def city_key(state_slug, city_slug, city_name, state_code):
    cid = f"{city_slug}-{state_code.lower()}"
    if cid not in cities:
        cities[cid] = OrderedDict(CityId=cid, Site="frilly", StateSlug=state_slug, CitySlug=city_slug,
                                  CityName=city_name, StateCode=state_code)
    return cid


featured = {"broken-board-coffee", "bloom-bake-shop", "stellie-s-ice-cream", "woof-s", "ninth-floor"}

for path in sorted(glob.glob(os.path.join(SCRAPE, "json", "*.json"))):
    d = json.load(open(path))
    url = d["metadata"]["entityUrl"].strip("/").split("/")
    state_slug, city_slug, seg, lid = url[0], url[1], url[2], url[3]
    loc = d.get("location", {})
    addr = loc.get("address") or {}
    cid = city_key(state_slug, city_slug, loc.get("city") or addr.get("city") or city_slug.title(),
                   loc.get("state") or addr.get("state") or "WI")
    cat_title = (d.get("category") or "Uncategorized").strip()
    cat_id = slug(cat_title)
    cats.setdefault(cat_id, OrderedDict(CategoryId=cat_id, Title=cat_title))
    sub_title = (d.get("subcategory") or "General").strip()
    sub_id = f"{cat_id}--{slug(sub_title)}"
    subs.setdefault(sub_id, OrderedDict(SubcategoryId=sub_id, Category=cat_id, Title=sub_title))
    coords = addr.get("coordinates") or [0, 0]
    contact = d.get("contact") or {}
    social = d.get("socialLinks") or {}
    listing_ids.add(lid)
    schema["Listings"]["data"].append(OrderedDict(
        ListingId=lid, Site="frilly", City=cid, EntityType=d.get("entityType") or "business",
        Category=cat_id, Subcategory=sub_id, Title=(d.get("name") or lid).strip(),
        Description=(d.get("description") or "").strip(), Tags=",".join(d.get("tags") or []),
        Phone=contact.get("phone") or "", Email=contact.get("email") or "", Website=contact.get("website") or "",
        Instagram=social.get("instagram") or "", Street=addr.get("street") or "", ZipCode=str(addr.get("zipCode") or ""),
        Latitude=float(coords[0] or 0), Longitude=float(coords[1] or 0),
        LogoUrl=f"https://logoharmonizer.clodhost.com/logos/{lid}.png" if lid in featured else "",
        IsFeatured=lid in featured, IsPublished=True,
        LastUpdated=d["metadata"].get("lastUpdated") or "", SourceId=d.get("id") or "",
    ))

# Events (from the JSON-LD on each event page)
for path in sorted(glob.glob(os.path.join(SCRAPE, "events", "*.json"))):
    d = json.load(open(path))
    ev = None
    for b in d["ld"]:
        for n in (b.get("@graph") or [b]):
            if "Event" in str(n.get("@type")):
                ev = n
    if not ev:
        continue
    parts = d["url"].replace("https://frilly.ai/", "").split("/")
    state_slug, city_slug = parts[0], parts[1]
    cid = city_key(state_slug, city_slug, city_slug.replace("-", " ").title(), "WI")
    organizer = (ev.get("organizer") or {}).get("@id", "")
    venue = organizer.rstrip("/").split("/")[-1] if organizer else ""
    if venue not in listing_ids:
        venue = ""
    # price: the page text has it right after the doors line
    price = ""
    txt = d.get("text") or []
    for i, line in enumerate(txt):
        if line.startswith("Doors") and i + 1 < len(txt):
            price = txt[i + 1]
            break
    offers = ev.get("offers")
    if not price and isinstance(offers, dict) and offers.get("price") is not None:
        price = str(offers.get("price"))
    genres = ev.get("genre") or []
    if isinstance(genres, dict):
        genres = [genres]
    kw = ev.get("keywords") or ""
    if isinstance(kw, list):
        kw = ", ".join(kw)
    schema["Events"]["data"].append(OrderedDict(
        EventId=d["slug"], Site="frilly", City=cid, Venue=venue, Title=(ev.get("name") or d["slug"]).strip(),
        Description=(ev.get("description") or "").strip(), StartsAt=ev.get("startDate") or "",
        EndsAt=ev.get("endDate") or "", DoorTime=ev.get("doorTime") or "", Price=price,
        EventKind=str(ev.get("@type") or "Event"), Keywords=kw,
        Genres=", ".join(g.get("name", "") for g in genres if isinstance(g, dict)),
        ImageUrl=ev.get("image") if isinstance(ev.get("image"), str) else "", SourceUrl=ev.get("url") or "",
        Status="cancelled" if "Cancelled" in str(ev.get("eventStatus")) else "scheduled",
    ))

schema["Cities"]["data"] = list(cities.values())
schema["Categories"]["data"] = sorted(cats.values(), key=lambda r: r["Title"])
schema["Subcategories"]["data"] = sorted(subs.values(), key=lambda r: r["SubcategoryId"])

# --------------------------------------------------------------------------
# __meta__ : brand tokens lifted from the live site's CSS (transpiler-ignored)
# --------------------------------------------------------------------------
meta_rows = [
    ("brand.font.body", "font", "IBM Plex Sans", "Primary UI font on frilly.ai."),
    ("brand.font.display", "font", "Kumbh Sans", "Display / heading font on frilly.ai."),
    ("brand.font.fallback", "font", "Inter", "Secondary sans fallback."),
    ("brand.color.ink", "color", "#021c29", "Deep navy used for the header and dark surfaces (rgb 2 28 41)."),
    ("brand.color.ink-2", "color", "#022e40", "Navy for footer / dark cards (rgb 2 46 64)."),
    ("brand.color.teal", "color", "#1d576f", "Teal brand accent (rgb 29 87 111)."),
    ("brand.color.teal-light", "color", "#8db3c4", "Light teal borders (rgb 141 179 196)."),
    ("brand.color.sky", "color", "#d3e2e9", "Pale sky text on dark surfaces (rgb 211 226 233)."),
    ("brand.color.mist", "color", "#e7f3f8", "Pale blue surface (rgb 231 243 248)."),
    ("brand.color.purple", "color", "#3d1878", "Primary purple for buttons and chips (rgb 61 24 120)."),
    ("brand.color.purple-mid", "color", "#633ba4", "Hover purple (rgb 99 59 164)."),
    ("brand.color.lavender", "color", "#ece0ff", "Lavender chip background (rgb 236 224 255)."),
    ("brand.color.lime", "color", "#b9d700", "Lime accent for highlights and CTAs (rgb 185 215 0)."),
    ("brand.color.lime-bright", "color", "#e7ff57", "Bright lime hover (rgb 231 255 87)."),
    ("brand.color.olive", "color", "#768807", "Dark lime for text on light (rgb 118 136 7)."),
    ("brand.color.orange", "color", "#d4570b", "Orange accent (rgb 212 87 11)."),
    ("brand.color.neutral-100", "color", "#f5f5f5", "Page background."),
    ("brand.color.neutral-400", "color", "#a3a3a3", "Muted text."),
    ("brand.color.neutral-800", "color", "#262626", "Body text."),
    ("brand.radius.card", "size", "12px", "Card corner radius."),
    ("site.source", "provenance", "https://frilly.ai (scraped 2026-10-03 via llms.txt, sitemap.xml, per-page .json and JSON-LD)", "Where the content came from."),
]
schema["__meta__"] = dict(
    Description="Global settings and brand tokens lifted from the live site. Transpiler-ignored (leading underscore). The UI reads these for fonts and colors so the prototype matches frilly.ai.",
    schema=[
        f("MetaKey", "string", description="Stable key."),
        f("Category", "string", description="font | color | size | provenance."),
        f("Value", "string", description="The value as text."),
        f("Description", "string", description="What it is for."),
    ],
    data=[OrderedDict(MetaKey=k, Category=c, Value=v, Description=dsc) for k, c, v, dsc in meta_rows],
)

rulebook = OrderedDict()
rulebook["$schema"] = "https://example.com/cmcc-schema/v1"
rulebook["Name"] = "Frilly Smart Directory"
rulebook["Description"] = ("The Frilly local directory (frilly.ai): businesses, organizations and makers in Greater Madison, WI, "
                           "plus the events they host. Every URL, flag, count and label the site shows is derived from the raw rows here.")
for k, v in schema.items():
    rulebook[k] = v

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as fh:
    json.dump(rulebook, fh, indent=2, ensure_ascii=False)
    fh.write("\n")

raw = derived = 0
for k, v in schema.items():
    if k.startswith("_"):
        continue
    for fld in v["schema"]:
        if fld["type"] in ("raw", "relationship"):
            raw += 1
        else:
            derived += 1
print(f"wrote {OUT}")
for k, v in schema.items():
    print(f"  {k:20} {len(v['data']):5} rows  {len(v['schema'])} fields")
print(f"derived fields: {derived}/{raw + derived} = {derived / (raw + derived) * 100:.0f}%")
