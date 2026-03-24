# -*- coding: utf-8 -*-
"""
@description: Optional integrations for popular RAG frameworks.

These adapters let you use TreeSearch as the retrieval backend inside
LangChain and LlamaIndex pipelines without adding any hard dependency on
those frameworks to the core ``treesearch`` package.

Usage::

    # LangChain
    from treesearch.integrations.langchain import TreeSearchRetriever

    # LlamaIndex
    from treesearch.integrations.llamaindex import TreeSearchNodeRetriever

Install the extras you need::

    pip install pytreesearch[langchain]
    pip install pytreesearch[llamaindex]
    pip install pytreesearch[integrations]   # both at once
"""
