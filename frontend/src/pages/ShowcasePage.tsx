import SpaceMapper from "../components/SpaceMapper/SpaceMapper";
import { SelectionProvider } from "../lib/selection/SelectionProvider";

// The demo office as it has been since phase 0. The selection lives with
// the page, so it starts empty each time the page is opened.
export default function ShowcasePage() {
  return (
    <SelectionProvider>
      <main className="mx-auto max-w-content px-sm pb-[130px] pt-lg sm:px-md">
        <SpaceMapper />
      </main>
    </SelectionProvider>
  );
}
