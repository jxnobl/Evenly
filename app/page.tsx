const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validMembers = members.map((m) => m.trim()).filter(Boolean);
    if (!tabName.trim() || validMembers.length < 2) {
      setErrorMsg("Please provide a tab name and at least 2 members.");
      return;
    }

    setLoading(true);

    try {
      const cleanSlug = `${tabName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Math.random().toString(36).substring(2, 7)}`;

      // 1. Insert Tab
      const { data: tabData, error: tabError } = await supabase
        .from("tabs")
        .insert([{ title: tabName.trim(), slug: cleanSlug }])
        .select()
        .single();

      if (tabError) {
        throw new Error(`Tab creation failed: ${tabError.message}`);
      }

      // 2. Insert Members
      const memberRows = validMembers.map((name) => ({
        tab_id: tabData.id,
        name,
      }));

      const { error: memError } = await supabase
        .from("tab_members")
        .insert(memberRows);

      if (memError) {
        throw new Error(`Member creation failed: ${memError.message}`);
      }

      // 3. Navigate only if successful
      router.push(`/tab/${tabData.slug}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to create tab.");
      setLoading(false);
    }
  };