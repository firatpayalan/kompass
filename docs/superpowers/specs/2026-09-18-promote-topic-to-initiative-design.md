# Promote initiative topic to initiative

## Goal

From an initiative’s detail view, convert a topic into a new initiative while keeping the topic (and its notes) under the original initiative, and leave a two-way trail via automatic notes.

## Trigger

- Right-click a topic card on **iş detayı** (not the person detail topics list)
- Context menu item: **İşe çevir**
- Confirm dialog before running:
  - Title: **İşe çevir**
  - Message: `“{topic title}” yeni bir iş olacak. Konu burada kalır; iki yönlü taşıma notu eklenir.`
  - Confirm label: **İşe çevir**

## Behavior

1. Create a new initiative named after the topic title (same name uniqueness rules as normal initiative create: reject duplicate with existing “Bu isimde kayıt var” / equivalent).
2. Leave the topic under the **original** initiative; do not reassign `topics.initiative_id`.
3. Leave existing topic notes linked as they are (no unlink / remount).
4. Create an automatic note on the **topic** (linked to the original initiative and to that topic), body like:
   - `Bu konu “{new initiative name}” işine taşınmıştır.`
5. Create an automatic note on the **new initiative** (initiative-linked, no topic), body like:
   - `“{topic title}” konusundan taşınmıştır.`
6. Toast success (e.g. **İş oluşturuldu**).
7. Navigate to / open the new initiative detail.

## Out of scope

- Promoting person-owned topics
- Deleting or renaming the source topic as part of this action
- Copying topic tags or initiative tags onto the new initiative
- Undo beyond normal archive/delete flows

## Version

Ship as a normal feature commit on the current app line (no separate version bump unless releasing).
